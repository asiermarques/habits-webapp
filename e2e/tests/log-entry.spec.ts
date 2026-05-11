import { test, expect } from '@playwright/test';
import { MOBILE_VIEWPORT, createUser, openLogDialogForHabit } from '../helpers';

// Today as YYYY-MM-DD in local time — mirrors todayIso() in the app.
function localIso(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}


test.describe('Log entry feature', () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    page.setViewportSize(MOBILE_VIEWPORT);
    await createUser(page, 'Log Entry Test User');
    await page.close();
  });

  // ── Log entry button state ────────────────────────────────────────────────

  test.describe('Log entry button state', () => {
    test('button is disabled when there is no active user', async ({ browser }) => {
      // Open a fresh context with no localStorage so there is no active user.
      const ctx = await browser.newContext({ storageState: undefined });
      const page = await ctx.newPage();
      page.setViewportSize(MOBILE_VIEWPORT);

      await page.goto('/');

      // The Log entry button (aria-label) should be rendered but disabled.
      await expect(page.getByRole('button', { name: 'Log entry' })).toBeDisabled();

      await ctx.close();
    });

    test('button is enabled when an active user with habits exists', async ({ page }) => {
      await page.goto('/');

      // Log Entry Test User was created in beforeAll and has seeded habits,
      // so the button must be enabled.
      await expect(page.getByRole('button', { name: 'Log entry' })).toBeEnabled();
    });
  });

  // ── Opening the log modal ─────────────────────────────────────────────────

  test.describe('Opening the log modal', () => {
    test('clicking "Log entry" opens a dialog', async ({ page }) => {
      await page.goto('/');
      await page.getByRole('button', { name: 'Log entry' }).click();

      await expect(page.getByRole('dialog')).toBeVisible();
    });

    test('dialog contains a Habit combobox and a Date field', async ({ page }) => {
      await page.goto('/');
      await page.getByRole('button', { name: 'Log entry' }).click();

      await expect(page.getByRole('combobox', { name: 'Habit' })).toBeVisible();
      await expect(page.getByLabel('Date')).toBeVisible();
    });

    test('Habit combobox lists habits in alphabetical order', async ({ page }) => {
      await page.goto('/');
      await page.getByRole('button', { name: 'Log entry' }).click();

      await page.getByRole('combobox', { name: 'Habit' }).click();

      const options = page.getByRole('option');
      const texts = await options.allTextContents();
      const sorted = [...texts].sort((a, b) => a.localeCompare(b));
      expect(texts).toEqual(sorted);

      await page.keyboard.press('Escape');
    });

    test('dialog shows the "Log entry" title and description', async ({ page }) => {
      await page.goto('/');
      await page.getByRole('button', { name: 'Log entry' }).click();

      await expect(page.getByRole('dialog').getByRole('heading', { name: 'Log entry' })).toBeVisible();
      await expect(
        page.getByText('Record a new entry for one of your habits.'),
      ).toBeVisible();
    });
  });

  // ── Logging a workout entry ───────────────────────────────────────────────

  test.describe('Logging a workout entry', () => {
    test('shows workout fields after selecting a workout habit', async ({ page }) => {
      await openLogDialogForHabit(page, 'Running');

      // Duration (min) is required; Distance (km) and Repetitions are optional.
      await expect(page.getByLabel('Duration (min)')).toBeVisible();
      await expect(page.getByLabel('Distance (km)')).toBeVisible();
      await expect(page.getByLabel('Weight (kg)')).toBeVisible();
      await expect(page.getByLabel('Repetitions')).toBeVisible();
      await expect(page.getByLabel('Notes')).toBeVisible();
    });

    test('submitting a workout entry adds a card to the entries list', async ({ page }) => {
      await openLogDialogForHabit(page, 'Running');

      await page.getByLabel('Duration (min)').fill('30');
      await page.getByLabel('Distance (km)').fill('5');
      await page.getByRole('button', { name: 'Log entry' }).click();

      await expect(page.getByRole('dialog')).not.toBeVisible();

      // Entry card should show the habit name and type badge.
      const list = page.locator('ul').first();
      await expect(list.getByText('Running').first()).toBeVisible();
      await expect(list.getByText('workout').first()).toBeVisible();
      // Summary line should include the duration and distance.
      await expect(page.getByText(/30 min/).first()).toBeVisible();
      await expect(page.getByText(/5 km/).first()).toBeVisible();
    });
  });

  // ── Logging a writing entry ───────────────────────────────────────────────

  test.describe('Logging a writing entry', () => {
    test('shows writing fields after selecting a writing habit', async ({ page }) => {
      await openLogDialogForHabit(page, 'Writing');

      await expect(page.getByLabel('Words')).toBeVisible();
      await expect(page.getByLabel('Time (min)')).toBeVisible();
    });

    test('submitting a writing entry adds a card with the correct summary', async ({ page }) => {
      await openLogDialogForHabit(page, 'Writing');

      await page.getByLabel('Words').fill('500');
      await page.getByLabel('Time (min)').fill('25');
      await page.getByRole('button', { name: 'Log entry' }).click();

      await expect(page.getByRole('dialog')).not.toBeVisible();

      const list = page.locator('ul').first();
      await expect(list.getByText('Writing').first()).toBeVisible();
      // The type badge for a writing habit.
      await expect(list.getByText('writing').first()).toBeVisible();
      // Summary line should show words and time.
      await expect(page.getByText(/500 words/).first()).toBeVisible();
      await expect(page.getByText(/25 min/).first()).toBeVisible();
    });
  });

  // ── Logging a custom entry ────────────────────────────────────────────────

  test.describe('Logging a custom entry', () => {
    test('shows custom fields after selecting a custom habit', async ({ page }) => {
      await openLogDialogForHabit(page, 'Reading');

      await expect(page.getByLabel('Repetitions')).toBeVisible();
      await expect(page.getByText(/Cost spent/)).toBeVisible();
      await expect(page.getByLabel('Duration (min)')).toBeVisible();
    });

    test('submitting a custom entry adds a card with the correct summary', async ({ page }) => {
      await openLogDialogForHabit(page, 'Reading');

      await page.getByLabel('Repetitions').fill('3');
      await page.getByRole('button', { name: 'Log entry' }).click();

      await expect(page.getByRole('dialog')).not.toBeVisible();

      const list = page.locator('ul').first();
      await expect(list.getByText('Reading').first()).toBeVisible();
      await expect(list.getByText('custom').first()).toBeVisible();
      // Repetitions appear in the summary.
      await expect(page.getByText(/3 reps/).first()).toBeVisible();
    });
  });

  // ── Date field ───────────────────────────────────────────────────────────

  test.describe('Date field', () => {
    test('date field defaults to today', async ({ page }) => {
      await page.goto('/');
      await page.getByRole('button', { name: 'Log entry' }).click();

      const today = localIso();
      await expect(page.getByLabel('Date')).toHaveValue(today);
    });

    test('backfilling a past date is reflected in the entry card', async ({ page }) => {
      await openLogDialogForHabit(page, 'Rowing');

      const pastDate = '2026-01-15';
      await page.getByLabel('Date').fill(pastDate);
      await page.getByLabel('Duration (min)').fill('20');
      await page.getByRole('button', { name: 'Log entry' }).click();

      await expect(page.getByRole('dialog')).not.toBeVisible();

      // The summary line shows the formatted date then "→ 20 min".
      // Match on the day-of-month (15) rather than locale-sensitive month/weekday names
      // to avoid divergence between Node.js and Chromium ICU data.
      await expect(page.locator('ul').first().getByText(/15.*→.*20 min/).first()).toBeVisible();
    });
  });

});
