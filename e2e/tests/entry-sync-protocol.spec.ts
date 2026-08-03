import { test, expect } from '@playwright/test';
import { MOBILE_VIEWPORT, BACKEND_URL, createUser, openLogDialogForHabit, switchToUser } from '../helpers';

const TEST_USER = 'Sync Protocol Test User';

// Covers 002-entry-sync-protocol: an Idempotency Key makes a retried push
// exactly-once (US-001), and a queued change whose target Entry vanished
// elsewhere resolves to a defined outcome instead of a blanket discard
// (US-003 delete, US-004 update re-creation).
test.describe('Entry sync protocol', () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    page.setViewportSize(MOBILE_VIEWPORT);
    await createUser(page, TEST_USER);
    await page.close();
  });

  // A fresh page falls back to whatever user is `isDefault` (typically the
  // first user created across the whole suite run), not necessarily this
  // file's own test user — explicit selection keeps entries scoped to the
  // user `findEntryId` looks up below.
  async function findEntryId(page: import('@playwright/test').Page, duration: number): Promise<number> {
    const usersRes = await page.request.get(`${BACKEND_URL}/api/users`);
    const users = (await usersRes.json()) as { id: number; name: string }[];
    const userId = users.find((u) => u.name === TEST_USER)!.id;
    const entriesRes = await page.request.get(`${BACKEND_URL}/api/entries?userId=${userId}`);
    const { items } = (await entriesRes.json()) as { items: { id: number; data: { duration?: number } }[] };
    return items.find((e) => e.data.duration === duration)!.id;
  }

  test('US-001: a lost response after the backend already applied a create does not duplicate the Entry on retry', async ({ page }) => {
    await switchToUser(page, TEST_USER);
    await openLogDialogForHabit(page, 'Running');
    await page.keyboard.press('Escape');

    await page.context().setOffline(true);
    await page.getByRole('button', { name: 'Log entry' }).click();
    const habitTrigger = page.getByRole('combobox', { name: 'Habit' });
    await habitTrigger.click();
    await page.getByRole('option', { name: 'Running' }).click();
    await page.getByLabel('Duration (min)').fill('77');
    await page.getByRole('button', { name: 'Log entry' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByRole('status')).toHaveText(/1 change pending/);

    // The first reconnect attempt really reaches the backend and applies
    // (GRISK-001's exact failure mode) — the response is aborted before the
    // page ever sees it, so the device can't know it succeeded.
    let postCount = 0;
    await page.route('**/api/entries', async (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      postCount += 1;
      if (postCount === 1) {
        await route.fetch();
        await route.abort('failed');
        return;
      }
      return route.continue();
    });

    await page.context().setOffline(false);
    await expect.poll(() => postCount).toBeGreaterThanOrEqual(1);
    // Still pending — the device never learned the first push landed.
    await expect(page.getByRole('status')).toHaveText(/1 change pending/);

    // A second drain attempt retries the same queued change under the same
    // Idempotency Key; the backend recognises it and doesn't reapply it.
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await expect(page.getByRole('status')).not.toBeVisible({ timeout: 10_000 });

    await page.unroute('**/api/entries');
    await page.reload();
    await expect(page.locator('ul').first().getByText(/77 min/)).toHaveCount(1);
  });

  test('US-003: a queued delete for an Entry already removed elsewhere clears silently with no notice', async ({ page }) => {
    await switchToUser(page, TEST_USER);
    await openLogDialogForHabit(page, 'Rowing');
    await page.getByLabel('Duration (min)').fill('33');
    await page.getByRole('button', { name: 'Log entry' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    const card = page.locator('ul').first().locator('li').filter({ hasText: '33 min' }).first();
    await expect(card).toBeVisible();

    // "Another device" deletes the same Entry directly against the backend
    // while this page's stale list still shows it.
    const entryId = await findEntryId(page, 33);
    await page.request.delete(`${BACKEND_URL}/api/entries/${entryId}`);

    await page.context().setOffline(true);
    await card.getByRole('button', { name: /delete entry/i }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByRole('alertdialog')).not.toBeVisible();
    await expect(page.getByRole('status')).toHaveText(/1 change pending/);

    await page.context().setOffline(false);
    await expect(page.getByRole('status')).not.toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/couldn't be saved and was discarded/i)).not.toBeVisible();
  });

  test('US-004: a queued edit for an Entry deleted elsewhere re-creates it and announces the recreation', async ({ page }) => {
    await switchToUser(page, TEST_USER);
    await openLogDialogForHabit(page, 'Rowing');
    await page.getByLabel('Duration (min)').fill('44');
    await page.getByRole('button', { name: 'Log entry' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    const card = page.locator('ul').first().locator('li').filter({ hasText: '44 min' }).first();
    await expect(card).toBeVisible();

    // "Another device" deletes the same Entry directly against the backend
    // while this page's stale list still shows it.
    const entryId = await findEntryId(page, 44);
    await page.request.delete(`${BACKEND_URL}/api/entries/${entryId}`);

    await page.context().setOffline(true);
    await card.getByRole('button', { name: /edit entry/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByLabel('Duration (min)').fill('55');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByRole('status')).toHaveText(/1 change pending/);

    await page.context().setOffline(false);
    await expect(page.getByText(/was recreated/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('status')).not.toBeVisible({ timeout: 10_000 });

    await page.reload();
    await expect(page.locator('ul').first().getByText(/55 min/)).toHaveCount(1);
  });
});
