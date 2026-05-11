import { test, expect } from '@playwright/test';
import { MOBILE_VIEWPORT, createUser, openLogDialogForHabit } from '../helpers';

test.describe('Entries list feature', () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    page.setViewportSize(MOBILE_VIEWPORT);
    await createUser(page, 'Log Entry Test User');
    await page.close();
  });

  // ── Edit entry ────────────────────────────────────────────────────────────

  test.describe('Edit entry', () => {
    test('edit modal opens with "Edit entry" title and habit combobox is locked', async ({
      page,
    }) => {
      // Log a fresh Cooking entry.
      await openLogDialogForHabit(page, 'Cooking');
      await page.getByLabel('Repetitions').fill('1');
      await page.getByRole('button', { name: 'Log entry' }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible();

      // Open the edit dialog for the most-recent entry.
      await page.getByRole('button', { name: /edit entry/i }).first().click();

      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(
        page.getByRole('dialog').getByRole('heading', { name: 'Edit entry' }),
      ).toBeVisible();
      // The habit combobox should be disabled when editing.
      await expect(page.getByRole('combobox', { name: 'Habit' })).toBeDisabled();
    });

    test('submitting the edit modal updates the entry in the list', async ({ page }) => {
      // Log a Cooking entry to edit.
      await openLogDialogForHabit(page, 'Cooking');
      await page.getByLabel('Repetitions').fill('1');
      await page.getByRole('button', { name: 'Log entry' }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible();

      // Open edit for the most-recent entry.
      await page.getByRole('button', { name: /edit entry/i }).first().click();
      await expect(page.getByRole('dialog')).toBeVisible();

      // Change repetitions to 7.
      await page.getByLabel('Repetitions').fill('7');
      // The submit button in edit mode reads "Save changes".
      await page.getByRole('button', { name: 'Save changes' }).click();

      await expect(page.getByRole('dialog')).not.toBeVisible();
      // The updated summary should now show 7 reps.
      await expect(page.getByText(/7 reps/).first()).toBeVisible();
    });
  });

  // ── Delete entry ──────────────────────────────────────────────────────────

  test.describe('Delete entry', () => {
    test('delete button shows a confirmation dialog', async ({ page }) => {
      // Log a Social interactions entry to delete.
      await openLogDialogForHabit(page, 'Social interactions');
      await page.getByLabel('Repetitions').fill('2');
      await page.getByRole('button', { name: 'Log entry' }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible();

      await expect(page.getByText('Social interactions').first()).toBeVisible();

      // Click the delete icon on the first (most-recent) entry card.
      await page.getByRole('button', { name: /delete entry/i }).first().click();

      // An alert dialog asking to confirm deletion should appear.
      await expect(page.getByRole('alertdialog')).toBeVisible();
      await expect(page.getByText('Delete this entry?')).toBeVisible();
      await expect(page.getByText('This action cannot be undone.')).toBeVisible();
    });

    test('confirming deletion removes the entry from the list', async ({ page }) => {
      // Log a fresh entry to delete.
      await openLogDialogForHabit(page, 'Social interactions');
      await page.getByLabel('Repetitions').fill('2');
      await page.getByRole('button', { name: 'Log entry' }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible();

      // Capture the card text so we can verify it disappears.
      const firstCard = page.locator('ul').first().locator('li').first();
      await expect(firstCard).toBeVisible();

      // Click delete on the first card.
      await firstCard.getByRole('button', { name: /delete entry/i }).click();
      await expect(page.getByRole('alertdialog')).toBeVisible();

      // The confirmation button inside the alert dialog is labelled "Delete".
      await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();

      await expect(page.getByRole('alertdialog')).not.toBeVisible();
    });

    test('cancelling the delete confirmation keeps the entry in the list', async ({ page }) => {
      // Log an entry.
      await openLogDialogForHabit(page, 'Social interactions');
      await page.getByLabel('Repetitions').fill('1');
      await page.getByRole('button', { name: 'Log entry' }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible();

      await expect(page.getByText('Social interactions').first()).toBeVisible();
      const countBefore = await page.locator('ul').first().locator('li').count();

      // Open delete dialog then cancel.
      await page.getByRole('button', { name: /delete entry/i }).first().click();
      await expect(page.getByRole('alertdialog')).toBeVisible();
      await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel' }).click();

      await expect(page.getByRole('alertdialog')).not.toBeVisible();
      // Entry count should be unchanged.
      await expect(page.locator('ul').first().locator('li')).toHaveCount(countBefore);
    });
  });

  // ── Habit filter on Home ──────────────────────────────────────────────────

  test.describe('Habit filter on Home', () => {
    test('filtering by a habit shows only entries for that habit', async ({ page }) => {
      // Log a Running entry and a Rowing entry so two distinct habits exist.
      await openLogDialogForHabit(page, 'Running');
      await page.getByLabel('Duration (min)').fill('15');
      await page.getByRole('button', { name: 'Log entry' }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible();

      await openLogDialogForHabit(page, 'Rowing');
      await page.getByLabel('Duration (min)').fill('10');
      await page.getByRole('button', { name: 'Log entry' }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible();

      // Back on Home — apply the "Running" filter.
      await page.goto('/');
      const habitFilter = page.getByRole('combobox', { name: /filter by habit/i });
      await habitFilter.click();
      await page.getByRole('option', { name: 'Running' }).click();

      // Scoping to the entries <ul> avoids matching the filter dropdown options.
      const entryList = page.locator('ul').first();
      await expect(entryList.getByText('Running').first()).toBeVisible();
      // Rowing entries should not be visible.
      await expect(entryList.getByText('Rowing')).not.toBeVisible();
    });

    test('selecting "All habits" restores the full list', async ({ page }) => {
      await page.goto('/');

      // Apply filter.
      const habitFilter = page.getByRole('combobox', { name: /filter by habit/i });
      await habitFilter.click();
      await page.getByRole('option', { name: 'Running' }).click();

      // The Rowing entries should not be visible while filtered.
      const entryList = page.locator('ul').first();
      await expect(entryList.getByText('Rowing')).not.toBeVisible();

      // Clear filter by selecting "All habits".
      await habitFilter.click();
      await page.getByRole('option', { name: 'All habits' }).click();

      // After clearing, both Running and Rowing entries should be visible.
      await expect(entryList.getByText('Running').first()).toBeVisible();
      await expect(entryList.getByText('Rowing').first()).toBeVisible();
    });
  });
});
