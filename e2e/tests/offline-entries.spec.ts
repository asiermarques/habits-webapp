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
