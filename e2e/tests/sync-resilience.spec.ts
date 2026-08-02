import { test, expect } from '@playwright/test';
import { MOBILE_VIEWPORT, createUser, openLogDialogForHabit } from '../helpers';

// Covers US-007/008/009 of 001-offline-entry-logging: a failing sync becomes
// visible with a manual retry, a server-rejected change is discarded with a
// notice rather than retried forever, and the explicit discard-all escape
// hatch in Settings.
//
// US-010 (pending changes hidden but retained across an Instance Gate
// re-lock) isn't exercised here: the e2e harness runs with GATE_PASSWORD=''
// (an open, ungated instance — see playwright.config.ts), so there is no
// lock screen to drive through Playwright. That behavior is covered by
// frontend/src/gate/__tests__/GateGuard.test.tsx and
// frontend/src/gate/__tests__/queries.test.tsx instead.
test.describe('Sync resilience', () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    page.setViewportSize(MOBILE_VIEWPORT);
    await createUser(page, 'Sync Resilience Test User');
    await page.close();
  });

  test('repeated server failures show a failing state with a manual retry, which recovers once the server does', async ({ page }) => {
    await openLogDialogForHabit(page, 'Running');
    await page.keyboard.press('Escape');

    await page.context().setOffline(true);
    await page.getByRole('button', { name: 'Log entry' }).click();
    const habitTrigger = page.getByRole('combobox', { name: 'Habit' });
    await habitTrigger.click();
    await page.getByRole('option', { name: 'Running' }).click();
    await page.getByLabel('Duration (min)').fill('14');
    await page.getByRole('button', { name: 'Log entry' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByRole('status')).toHaveText(/1 change pending/);

    // Every POST /entries fails as a transient (retryable) server error.
    await page.route('**/api/entries', (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'boom' }) });
      }
      return route.continue();
    });

    // Back online: the reconnect drain is attempt #1. Two more manually
    // dispatched 'online' events give attempts #2 and #3, crossing the
    // failing-state threshold without waiting out the 30s poll interval.
    const firstDrainResponse = page.waitForResponse(
      (res) => res.url().includes('/api/entries') && res.request().method() === 'POST',
    );
    await page.context().setOffline(false);
    await firstDrainResponse;

    for (let i = 0; i < 2; i++) {
      const responsePromise = page.waitForResponse(
        (res) => res.url().includes('/api/entries') && res.request().method() === 'POST',
      );
      await page.evaluate(() => window.dispatchEvent(new Event('online')));
      await responsePromise;
    }

    await expect(page.getByRole('status')).toHaveText(/failing/i);
    const retryButton = page.getByRole('button', { name: /retry/i });
    await expect(retryButton).toBeVisible();
    // Still exactly one pending change — a failing sync doesn't lose the item.
    await expect(page.getByText(/14 min/).first()).toBeVisible();

    // Let the retry reach the real backend and succeed.
    await page.unroute('**/api/entries');
    await retryButton.click();

    await expect(page.getByRole('status')).not.toBeVisible({ timeout: 10_000 });
    await page.reload();
    await expect(page.locator('ul').first().getByText(/14 min/).first()).toBeVisible();
  });

  test('a change the server rejects on its merits is discarded with a notice, not retried forever', async ({ page }) => {
    await openLogDialogForHabit(page, 'Rowing');
    await page.keyboard.press('Escape');

    await page.context().setOffline(true);
    await page.getByRole('button', { name: 'Log entry' }).click();
    const habitTrigger = page.getByRole('combobox', { name: 'Habit' });
    await habitTrigger.click();
    await page.getByRole('option', { name: 'Rowing' }).click();
    await page.getByLabel('Duration (min)').fill('22');
    await page.getByRole('button', { name: 'Log entry' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByRole('status')).toHaveText(/1 change pending/);

    // The server refuses this one on its merits (e.g. its Habit Definition
    // was deleted elsewhere) — not a transient failure, a real rejection.
    await page.route('**/api/entries', (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Habit definition not found' }),
        });
      }
      return route.continue();
    });

    const rejectedResponse = page.waitForResponse(
      (res) => res.url().includes('/api/entries') && res.request().method() === 'POST',
    );
    await page.context().setOffline(false);
    await rejectedResponse;

    // Discarded, not left stuck in the backlog, and the user is told why.
    await expect(page.getByText(/couldn't be saved and was discarded/i)).toBeVisible();
    await expect(page.getByRole('status')).not.toBeVisible();
    await expect(page.getByText(/22 min/)).not.toBeVisible();

    await page.unroute('**/api/entries');
    await page.reload();
    await expect(page.getByText(/22 min/)).not.toBeVisible();
  });

  test('the explicit discard-all action in Settings clears a stuck backlog', async ({ page }) => {
    await openLogDialogForHabit(page, 'Running');
    await page.keyboard.press('Escape');

    await page.context().setOffline(true);
    await page.getByRole('button', { name: 'Log entry' }).click();
    const habitTrigger = page.getByRole('combobox', { name: 'Habit' });
    await habitTrigger.click();
    await page.getByRole('option', { name: 'Running' }).click();
    await page.getByLabel('Duration (min)').fill('40');
    await page.getByRole('button', { name: 'Log entry' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByRole('status')).toHaveText(/1 change pending/);

    // Client-side navigation only — no service worker in the e2e harness
    // (see the top-of-file note), so a full page.goto() would fail offline.
    await page.getByRole('link', { name: 'Settings' }).click();
    const discardButton = page.getByRole('button', { name: /discard 1 pending change/i });
    await expect(discardButton).toBeVisible();
    await discardButton.click();
    await page.getByRole('alertdialog').getByRole('button', { name: /discard all pending changes/i }).click();

    await expect(page.getByRole('button', { name: /discard.*pending change/i })).not.toBeVisible();
    await expect(page.getByRole('status')).not.toBeVisible();

    await page.context().setOffline(false);
    await page.goto('/');
    await expect(page.getByText(/40 min/)).not.toBeVisible();
  });
});
