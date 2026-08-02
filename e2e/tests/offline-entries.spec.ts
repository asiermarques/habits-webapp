import { test, expect } from '@playwright/test';
import { MOBILE_VIEWPORT, createUser, openLogDialogForHabit } from '../helpers';

// Covers US-001/002/003 of 001-offline-entry-logging: logging an Entry with
// no connectivity, the pending indicator, and automatic sync on reconnect.
//
// The e2e harness runs Vite with the PWA plugin disabled (ARCHITECTURE.md
// "PWA / service worker"), so there is no service worker to serve the app
// shell while `page.context().setOffline(true)` blocks all requests. That
// means a true "close and reopen the app while offline" flow can't be
// exercised here — it's covered instead by the offlineStore unit tests
// (frontend/src/entries/__tests__/offlineStore.test.ts), which persist
// directly to localStorage, the same durability mechanism the app uses.
// This spec covers what the harness *can* exercise end-to-end: creating
// offline, seeing it live with no error, and the sync-on-reconnect path.
test.describe('Offline entry logging', () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    page.setViewportSize(MOBILE_VIEWPORT);
    await createUser(page, 'Offline Test User');
    await page.close();
  });

  test('logging an Entry with no connectivity succeeds, shows no error, and syncs once back online', async ({ page }) => {
    await openLogDialogForHabit(page, 'Running');
    // Close the dialog opened just to establish the active user/habits cache
    // before going offline — the habit list itself needs network to load.
    await page.keyboard.press('Escape');

    await page.context().setOffline(true);

    await page.getByRole('button', { name: 'Log entry' }).click();
    const habitTrigger = page.getByRole('combobox', { name: 'Habit' });
    await habitTrigger.click();
    await page.getByRole('option', { name: 'Running' }).click();
    await page.getByLabel('Duration (min)').fill('12');
    await page.getByRole('button', { name: 'Log entry' }).click();

    // Modal closes as if it succeeded — no "you're offline" toast (FR-009).
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByText(/you're offline/i)).not.toBeVisible();

    // Appears immediately in the entries list, and the header says one change
    // is pending (FR-002, FR-005).
    const list = page.locator('ul').first();
    await expect(list.getByText(/12 min/).first()).toBeVisible();
    await expect(page.getByRole('status')).toHaveText(/1 change pending/);

    // Reconnect: the drain pushes it automatically (FR-007) and the
    // indicator clears once the backend has accepted it (FR-006).
    await page.context().setOffline(false);
    await expect(page.getByRole('status')).not.toBeVisible({ timeout: 10_000 });

    // Reload against the real backend: the Entry is now a synced server Entry.
    await page.reload();
    await expect(page.locator('ul').first().getByText(/12 min/).first()).toBeVisible();
  });
});

// Covers US-004/005/006 of 001-offline-entry-logging: editing and deleting an
// Entry offline (both a synced one and one that was itself created offline),
// and the collapse of a full create->edit->delete sequence to nothing.
test.describe('Offline entry edit and delete', () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    page.setViewportSize(MOBILE_VIEWPORT);
    await createUser(page, 'Offline Edit Test User');
    await page.close();
  });

  test('editing a synced Entry offline updates it immediately and syncs the change on reconnect', async ({ page }) => {
    // Log a synced Entry while online.
    await openLogDialogForHabit(page, 'Running');
    await page.getByLabel('Duration (min)').fill('20');
    await page.getByRole('button', { name: 'Log entry' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.locator('ul').first().getByText(/20 min/).first()).toBeVisible();

    await page.context().setOffline(true);

    await page.getByRole('button', { name: /edit entry/i }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Habit' })).toBeDisabled();
    await page.getByLabel('Duration (min)').fill('35');
    await page.getByRole('button', { name: 'Save changes' }).click();

    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.locator('ul').first().getByText(/35 min/).first()).toBeVisible();
    await expect(page.getByRole('status')).toHaveText(/1 change pending/);

    // A true offline reload can't be exercised here — no service worker in
    // the e2e harness (see the top-of-file note) — so persistence across
    // reload is covered by offlineStore.test.ts instead.
    await page.context().setOffline(false);
    await expect(page.getByRole('status')).not.toBeVisible({ timeout: 10_000 });

    await page.reload();
    await expect(page.locator('ul').first().getByText(/35 min/).first()).toBeVisible();
  });

  test('deleting a synced Entry offline removes it immediately and the deletion syncs on reconnect', async ({ page }) => {
    await openLogDialogForHabit(page, 'Rowing');
    await page.getByLabel('Duration (min)').fill('18');
    await page.getByRole('button', { name: 'Log entry' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    const firstCard = page.locator('ul').first().locator('li').first();
    await expect(firstCard).toContainText('18 min');

    await page.context().setOffline(true);

    await firstCard.getByRole('button', { name: /delete entry/i }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByRole('alertdialog')).not.toBeVisible();

    await expect(page.locator('ul').first().getByText(/18 min/)).not.toBeVisible();
    await expect(page.getByRole('status')).toHaveText(/1 change pending/);

    await page.context().setOffline(false);
    await expect(page.getByRole('status')).not.toBeVisible({ timeout: 10_000 });

    await page.reload();
    await expect(page.locator('ul').first().getByText(/18 min/)).not.toBeVisible();
  });

  test('creating, editing and deleting an Entry offline nets to nothing pending and no request on reconnect', async ({ page }) => {
    // Filter Home to "Cooking" while online — warms the filtered entries
    // cache before going offline. This User has other habits' (and possibly
    // other Cooking) Entries from earlier in the suite, so cards below are
    // matched by their exact rep count, not by list position — a pending
    // Entry dated today doesn't necessarily sort above a synced one dated
    // today (same-day ties break on id, and a pending Entry's id is always
    // negative).
    await openLogDialogForHabit(page, 'Cooking');
    await page.keyboard.press('Escape');
    const habitFilter = page.getByRole('combobox', { name: /filter by habit/i });
    await habitFilter.click();
    await page.getByRole('option', { name: 'Cooking' }).click();

    await page.context().setOffline(true);

    await page.getByRole('button', { name: 'Log entry' }).click();
    const habitTrigger = page.getByRole('combobox', { name: 'Habit' });
    await habitTrigger.click();
    await page.getByRole('option', { name: 'Cooking' }).click();
    await page.getByLabel('Repetitions').fill('3');
    await page.getByRole('button', { name: 'Log entry' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    const list = page.locator('ul').first();
    const created = list.locator('li').filter({ hasText: /\b3 reps\b/ });
    await expect(created).toHaveCount(1);
    await expect(page.getByRole('status')).toHaveText(/1 change pending/);

    await created.getByRole('button', { name: /edit entry/i }).click();
    await page.getByLabel('Repetitions').fill('9');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    const edited = list.locator('li').filter({ hasText: /\b9 reps\b/ });
    await expect(edited).toHaveCount(1);
    // Amended in place — still exactly one pending change, not two.
    await expect(page.getByRole('status')).toHaveText(/1 change pending/);

    await edited.getByRole('button', { name: /delete entry/i }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByRole('alertdialog')).not.toBeVisible();

    await expect(list.locator('li').filter({ hasText: /\b9 reps\b/ })).toHaveCount(0);
    // Nothing left to push — the whole sequence collapsed to nothing.
    await expect(page.getByRole('status')).not.toBeVisible();

    await page.context().setOffline(false);
    // No lingering drain traffic — reload against the real backend and
    // confirm the Entry never existed there.
    await page.reload();
    await expect(list.locator('li').filter({ hasText: /\b9 reps\b/ })).toHaveCount(0);
  });
});
