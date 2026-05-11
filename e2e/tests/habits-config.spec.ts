import { test, expect } from '@playwright/test';
import { MOBILE_VIEWPORT, createUser, openLogDialogForHabit } from '../helpers';

const USER_NAME = 'Habits Config Test User';

// Seeded workout habits for this user.
const WORKOUT_HABITS = ['Running', 'Rowing'];
// Seeded writing habits.
const WRITING_HABITS = ['Writing'];
// Seeded custom habits — positive ones.
const POSITIVE_CUSTOM_HABITS = ['Reading', 'Cooking', 'Social interactions'];
// Seeded custom habits — negative ones.
const NEGATIVE_CUSTOM_HABITS = ['Meat consuming', 'Fast food consuming'];

test.describe('Habits configuration feature', () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    page.setViewportSize(MOBILE_VIEWPORT);
    await createUser(page, USER_NAME);
    await page.close();
  });

  // ── Section visibility ────────────────────────────────────────────────────

  test.describe('Section visibility', () => {
    test('shows empty-state message when there is no active user', async ({ browser }) => {
      // Open a fresh context without localStorage so no active user is set.
      const ctx = await browser.newContext({ storageState: undefined });
      const page = await ctx.newPage();
      page.setViewportSize(MOBILE_VIEWPORT);

      await page.goto('/settings');

      await expect(
        page.getByText('Add a user above to start defining habits.'),
      ).toBeVisible();

      await ctx.close();
    });

    test('shows "Habit Definitions" heading when an active user exists', async ({ page }) => {
      await page.goto('/settings');

      await expect(page.getByRole('heading', { name: 'Habit Definitions' })).toBeVisible();
    });

    test('shows the description mentioning the active user name', async ({ page }) => {
      await page.goto('/settings');

      // The active user may be any user (the app auto-selects the backend default).
      // Assert the template is present with *some* name, not a specific one.
      await expect(page.getByText(/Habits for .+\. Each user has their own list\./)).toBeVisible();
    });

    test('shows the "New" button to add a habit', async ({ page }) => {
      await page.goto('/settings');

      await expect(page.getByRole('button', { name: 'New' })).toBeVisible();
    });
  });

  // ── Habit list grouped by type ────────────────────────────────────────────

  test.describe('Habit list grouped by type', () => {
    test('seeded workout habits appear under the WORKOUT section', async ({ page }) => {
      await page.goto('/settings');

      const workoutSection = page.locator('div').filter({
        has: page.getByRole('heading', { name: 'WORKOUT' }),
      });

      for (const name of WORKOUT_HABITS) {
        await expect(workoutSection.getByText(name)).toBeVisible();
      }
    });

    test('seeded writing habits appear under the WRITING section', async ({ page }) => {
      await page.goto('/settings');

      const writingSection = page.locator('div').filter({
        has: page.getByRole('heading', { name: 'WRITING' }),
      });

      for (const name of WRITING_HABITS) {
        // Scope to <li> to avoid strict-mode clash: heading and habit name are both "Writing".
        await expect(writingSection.locator('li').filter({ hasText: name })).toBeVisible();
      }
    });

    test('seeded custom habits appear under the CUSTOM section', async ({ page }) => {
      await page.goto('/settings');

      const customSection = page.locator('div').filter({
        has: page.getByRole('heading', { name: 'CUSTOM' }),
      });

      for (const name of [...POSITIVE_CUSTOM_HABITS, ...NEGATIVE_CUSTOM_HABITS]) {
        await expect(customSection.getByText(name)).toBeVisible();
      }
    });

    test('negative custom habits show a "negative" badge', async ({ page }) => {
      await page.goto('/settings');

      for (const name of NEGATIVE_CUSTOM_HABITS) {
        // Each habit row is a list item; scope the badge lookup to the row.
        const row = page.locator('li').filter({ hasText: name });
        await expect(row.getByText('negative')).toBeVisible();
      }
    });

    test('positive custom habits do not show a "negative" badge', async ({ page }) => {
      await page.goto('/settings');

      for (const name of POSITIVE_CUSTOM_HABITS) {
        const row = page.locator('li').filter({ hasText: name });
        await expect(row.getByText('negative')).not.toBeVisible();
      }
    });

    test('each habit row has Edit and Delete buttons', async ({ page }) => {
      await page.goto('/settings');

      await expect(page.getByRole('button', { name: `Edit ${WORKOUT_HABITS[0]}` })).toBeVisible();
      await expect(page.getByRole('button', { name: `Delete ${WORKOUT_HABITS[0]}` })).toBeVisible();
    });
  });

  // ── Add habit ─────────────────────────────────────────────────────────────

  test.describe('Add habit', () => {
    test('clicking "New" opens a dialog with title "New habit"', async ({ page }) => {
      await page.goto('/settings');

      await page.getByRole('button', { name: 'New' }).click();

      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(
        page.getByRole('dialog').getByRole('heading', { name: 'New habit' }),
      ).toBeVisible();
    });

    test('dialog shows the add description mentioning the user name', async ({ page }) => {
      await page.goto('/settings');

      await page.getByRole('button', { name: 'New' }).click();

      // The description uses the active user's name, which may be any user in the shared DB.
      await expect(page.getByText(/Add a new habit for .+\./)).toBeVisible();
    });

    test('dialog contains Name field, Type selector, and "Add habit" submit button', async ({
      page,
    }) => {
      await page.goto('/settings');

      await page.getByRole('button', { name: 'New' }).click();

      await expect(page.getByRole('dialog').getByLabel('Name')).toBeVisible();
      // The Type field is a Radix Select rendered as a combobox.
      await expect(page.getByRole('combobox', { name: 'Type' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Add habit' })).toBeVisible();
    });

    test('type defaults to Custom', async ({ page }) => {
      await page.goto('/settings');

      await page.getByRole('button', { name: 'New' }).click();

      await expect(page.getByRole('combobox', { name: 'Type' })).toHaveText(/Custom/);
    });

    test('"Positive habit" toggle is visible when type is Custom', async ({ page }) => {
      await page.goto('/settings');

      await page.getByRole('button', { name: 'New' }).click();

      // Type defaults to Custom, so the toggle should be visible immediately.
      await expect(page.getByLabel('Positive habit')).toBeVisible();
    });

    test('"Positive habit" toggle is hidden when type is Workout', async ({ page }) => {
      await page.goto('/settings');

      await page.getByRole('button', { name: 'New' }).click();

      // Switch to Workout type.
      await page.getByRole('combobox', { name: 'Type' }).click();
      await page.getByRole('option', { name: 'Workout' }).click();

      await expect(page.getByLabel('Positive habit')).not.toBeVisible();
    });

    test('"Positive habit" toggle is hidden when type is Writing', async ({ page }) => {
      await page.goto('/settings');

      await page.getByRole('button', { name: 'New' }).click();

      // Switch to Writing type.
      await page.getByRole('combobox', { name: 'Type' }).click();
      await page.getByRole('option', { name: 'Writing' }).click();

      await expect(page.getByLabel('Positive habit')).not.toBeVisible();
    });

    test('adding a custom habit places it in the CUSTOM section', async ({ page }) => {
      await page.goto('/settings');

      await page.getByRole('button', { name: 'New' }).click();

      await page.getByRole('dialog').getByLabel('Name').fill('My Custom Habit');
      // Type is already Custom by default.
      await page.getByRole('button', { name: 'Add habit' }).click();

      await expect(page.getByRole('dialog')).not.toBeVisible();

      const customSection = page.locator('div').filter({
        has: page.getByRole('heading', { name: 'CUSTOM' }),
      });
      await expect(customSection.getByText('My Custom Habit')).toBeVisible();

      // Clean up: delete the habit so it does not pollute later tests.
      await page.getByRole('button', { name: 'Delete My Custom Habit' }).click();
      await expect(page.getByRole('alertdialog')).toBeVisible();
      await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
      await expect(page.getByRole('alertdialog')).not.toBeVisible();
    });

    test('adding a workout habit places it in the WORKOUT section', async ({ page }) => {
      await page.goto('/settings');

      await page.getByRole('button', { name: 'New' }).click();

      await page.getByRole('dialog').getByLabel('Name').fill('My Workout Habit');
      await page.getByRole('combobox', { name: 'Type' }).click();
      await page.getByRole('option', { name: 'Workout' }).click();
      await page.getByRole('button', { name: 'Add habit' }).click();

      await expect(page.getByRole('dialog')).not.toBeVisible();

      const workoutSection = page.locator('div').filter({
        has: page.getByRole('heading', { name: 'WORKOUT' }),
      });
      await expect(workoutSection.getByText('My Workout Habit')).toBeVisible();

      // Clean up.
      await page.getByRole('button', { name: 'Delete My Workout Habit' }).click();
      await expect(page.getByRole('alertdialog')).toBeVisible();
      await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
      await expect(page.getByRole('alertdialog')).not.toBeVisible();
    });

    test('clicking Cancel closes the dialog without adding a habit', async ({ page }) => {
      await page.goto('/settings');

      await page.getByRole('button', { name: 'New' }).click();

      await page.getByRole('dialog').getByLabel('Name').fill('Habit That Should Not Appear');
      await page.getByRole('button', { name: 'Cancel' }).click();

      await expect(page.getByRole('dialog')).not.toBeVisible();
      await expect(page.getByText('Habit That Should Not Appear')).not.toBeVisible();
    });
  });

  // ── Positive toggle ───────────────────────────────────────────────────────

  test.describe('Positive toggle', () => {
    test('toggle defaults to on (positive) for a new custom habit', async ({ page }) => {
      await page.goto('/settings');

      await page.getByRole('button', { name: 'New' }).click();

      // The switch should be checked (aria-checked="true") by default.
      await expect(page.getByRole('switch', { name: 'Positive habit' })).toHaveAttribute(
        'aria-checked',
        'true',
      );
    });

    test('turning the toggle off gives the saved habit a "negative" badge', async ({ page }) => {
      await page.goto('/settings');

      await page.getByRole('button', { name: 'New' }).click();

      await page.getByRole('dialog').getByLabel('Name').fill('My Negative Custom');
      // Toggle is on by default — click it to turn it off.
      await page.getByRole('switch', { name: 'Positive habit' }).click();
      await expect(page.getByRole('switch', { name: 'Positive habit' })).toHaveAttribute(
        'aria-checked',
        'false',
      );
      await page.getByRole('button', { name: 'Add habit' }).click();

      await expect(page.getByRole('dialog')).not.toBeVisible();

      const row = page.locator('li').filter({ hasText: 'My Negative Custom' });
      // exact: true to avoid substring match on "My Negative Custom" itself.
      await expect(row.getByText('negative', { exact: true })).toBeVisible();

      // Clean up.
      await page.getByRole('button', { name: 'Delete My Negative Custom' }).click();
      await expect(page.getByRole('alertdialog')).toBeVisible();
      await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
      await expect(page.getByRole('alertdialog')).not.toBeVisible();
    });

    test('a positive custom habit does not show a "negative" badge after save', async ({ page }) => {
      await page.goto('/settings');

      await page.getByRole('button', { name: 'New' }).click();

      await page.getByRole('dialog').getByLabel('Name').fill('My Positive Custom');
      // Leave toggle at its default (on = positive).
      await page.getByRole('button', { name: 'Add habit' }).click();

      await expect(page.getByRole('dialog')).not.toBeVisible();

      const row = page.locator('li').filter({ hasText: 'My Positive Custom' });
      await expect(row.getByText('My Positive Custom')).toBeVisible();
      await expect(row.getByText('negative')).not.toBeVisible();

      // Clean up.
      await page.getByRole('button', { name: 'Delete My Positive Custom' }).click();
      await expect(page.getByRole('alertdialog')).toBeVisible();
      await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
      await expect(page.getByRole('alertdialog')).not.toBeVisible();
    });
  });

  // ── Edit habit ────────────────────────────────────────────────────────────

  test.describe('Edit habit', () => {
    test('clicking the Edit button opens a dialog with title "Edit habit"', async ({ page }) => {
      await page.goto('/settings');

      await page.getByRole('button', { name: `Edit ${WORKOUT_HABITS[0]}` }).click();

      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(
        page.getByRole('dialog').getByRole('heading', { name: 'Edit habit' }),
      ).toBeVisible();
    });

    test('edit dialog shows the update description', async ({ page }) => {
      await page.goto('/settings');

      await page.getByRole('button', { name: `Edit ${WORKOUT_HABITS[0]}` }).click();

      await expect(
        page.getByText('Update the habit name, type, or whether it is positive.'),
      ).toBeVisible();
    });

    test('edit dialog pre-fills the Name field with the existing habit name', async ({ page }) => {
      await page.goto('/settings');

      await page.getByRole('button', { name: `Edit ${WORKOUT_HABITS[0]}` }).click();

      await expect(page.getByRole('dialog').getByLabel('Name')).toHaveValue(WORKOUT_HABITS[0]);
    });

    test('edit dialog pre-fills the Type with the existing habit type', async ({ page }) => {
      await page.goto('/settings');

      await page.getByRole('button', { name: `Edit ${WORKOUT_HABITS[0]}` }).click();

      await expect(page.getByRole('combobox', { name: 'Type' })).toHaveText(/Workout/);
    });

    test('saving with a new name updates the habit row', async ({ page }) => {
      await page.goto('/settings');

      // Add a habit to edit so we do not permanently rename a seed habit.
      await page.getByRole('button', { name: 'New' }).click();
      await page.getByRole('dialog').getByLabel('Name').fill('Habit To Rename');
      await page.getByRole('button', { name: 'Add habit' }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible();

      // Edit it.
      await page.getByRole('button', { name: 'Edit Habit To Rename' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.getByRole('dialog').getByLabel('Name').fill('Renamed Habit');
      await page.getByRole('button', { name: 'Save changes' }).click();

      await expect(page.getByRole('dialog')).not.toBeVisible();
      await expect(page.getByText('Renamed Habit')).toBeVisible();
      await expect(page.getByText('Habit To Rename')).not.toBeVisible();

      // Clean up.
      await page.getByRole('button', { name: 'Delete Renamed Habit' }).click();
      await expect(page.getByRole('alertdialog')).toBeVisible();
      await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
      await expect(page.getByRole('alertdialog')).not.toBeVisible();
    });

    test('clicking Cancel in the edit dialog closes it without saving', async ({ page }) => {
      await page.goto('/settings');

      await page.getByRole('button', { name: `Edit ${WRITING_HABITS[0]}` }).click();
      await expect(page.getByRole('dialog')).toBeVisible();

      await page.getByRole('dialog').getByLabel('Name').fill('Should Not Be Saved');
      await page.getByRole('button', { name: 'Cancel' }).click();

      await expect(page.getByRole('dialog')).not.toBeVisible();
      await expect(page.getByText('Should Not Be Saved')).not.toBeVisible();
      // Use the edit button as a proxy — avoids strict-mode clash between the "Writing"
      // section heading and the "Writing" habit name both being in the DOM.
      await expect(page.getByRole('button', { name: `Edit ${WRITING_HABITS[0]}` })).toBeVisible();
    });
  });

  // ── Type lock on edit ─────────────────────────────────────────────────────

  test.describe('Type lock on edit', () => {
    test('type combobox is disabled and lock message shown when habit has entries', async ({
      page,
    }) => {
      // Create a new workout habit via the UI.
      await page.goto('/settings');
      await page.getByRole('button', { name: 'New' }).click();
      await page.getByRole('dialog').getByLabel('Name').fill('Locked Type Habit');
      await page.getByRole('combobox', { name: 'Type' }).click();
      await page.getByRole('option', { name: 'Workout' }).click();
      await page.getByRole('button', { name: 'Add habit' }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible();

      // Log an entry for it so hasEntries becomes true.
      await openLogDialogForHabit(page, 'Locked Type Habit');
      await page.getByLabel('Duration (min)').fill('10');
      await page.getByRole('button', { name: 'Log entry' }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible();

      // Navigate to Settings and open the edit dialog for this habit.
      await page.goto('/settings');
      await page.getByRole('button', { name: 'Edit Locked Type Habit' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();

      // Type combobox should be disabled.
      await expect(page.getByRole('combobox', { name: 'Type' })).toBeDisabled();

      // Lock message should be visible.
      await expect(
        page.getByText('Type is locked because entries already exist for this habit.'),
      ).toBeVisible();

      // Close dialog — the habit will be left with entries so delete is blocked.
      await page.getByRole('button', { name: 'Cancel' }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible();
    });
  });

  // ── Delete habit (no entries) ─────────────────────────────────────────────

  test.describe('Delete habit (no entries)', () => {
    test('delete button opens an alert dialog with habit name in the title', async ({ page }) => {
      await page.goto('/settings');

      // Add a deletable habit.
      await page.getByRole('button', { name: 'New' }).click();
      await page.getByRole('dialog').getByLabel('Name').fill('Deletable Habit');
      await page.getByRole('button', { name: 'Add habit' }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible();

      await page.getByRole('button', { name: 'Delete Deletable Habit' }).click();

      await expect(page.getByRole('alertdialog')).toBeVisible();
      await expect(
        page.getByRole('alertdialog').getByRole('heading', { name: 'Delete Deletable Habit?' }),
      ).toBeVisible();

      // Cancel to leave the habit in place for the next test.
      await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel' }).click();
      await expect(page.getByRole('alertdialog')).not.toBeVisible();

      // Clean up.
      await page.getByRole('button', { name: 'Delete Deletable Habit' }).click();
      await expect(page.getByRole('alertdialog')).toBeVisible();
      await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
      await expect(page.getByRole('alertdialog')).not.toBeVisible();
    });

    test('alert dialog shows "This action cannot be undone." for a habit with no entries', async ({
      page,
    }) => {
      await page.goto('/settings');

      // Add a fresh habit with no entries.
      await page.getByRole('button', { name: 'New' }).click();
      await page.getByRole('dialog').getByLabel('Name').fill('No Entries Habit');
      await page.getByRole('button', { name: 'Add habit' }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible();

      await page.getByRole('button', { name: 'Delete No Entries Habit' }).click();

      await expect(page.getByRole('alertdialog')).toBeVisible();
      await expect(page.getByText('This action cannot be undone.')).toBeVisible();

      // Also verify the Delete button is enabled (not blocked).
      await expect(
        page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }),
      ).toBeEnabled();

      // Confirm deletion.
      await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
      await expect(page.getByRole('alertdialog')).not.toBeVisible();
    });

    test('confirming deletion removes the habit from the list', async ({ page }) => {
      await page.goto('/settings');

      // Add a habit to delete.
      await page.getByRole('button', { name: 'New' }).click();
      await page.getByRole('dialog').getByLabel('Name').fill('Habit To Delete');
      await page.getByRole('button', { name: 'Add habit' }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible();
      await expect(page.getByText('Habit To Delete')).toBeVisible();

      // Delete it.
      await page.getByRole('button', { name: 'Delete Habit To Delete' }).click();
      await expect(page.getByRole('alertdialog')).toBeVisible();
      await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();

      await expect(page.getByRole('alertdialog')).not.toBeVisible();
      await expect(page.getByText('Habit To Delete')).not.toBeVisible();
    });

    test('clicking Cancel in the delete dialog keeps the habit in the list', async ({ page }) => {
      await page.goto('/settings');

      // Add a habit.
      await page.getByRole('button', { name: 'New' }).click();
      await page.getByRole('dialog').getByLabel('Name').fill('Kept Habit');
      await page.getByRole('button', { name: 'Add habit' }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible();
      await expect(page.getByText('Kept Habit')).toBeVisible();

      // Open delete dialog and cancel.
      await page.getByRole('button', { name: 'Delete Kept Habit' }).click();
      await expect(page.getByRole('alertdialog')).toBeVisible();
      await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel' }).click();

      await expect(page.getByRole('alertdialog')).not.toBeVisible();
      await expect(page.getByText('Kept Habit')).toBeVisible();

      // Clean up.
      await page.getByRole('button', { name: 'Delete Kept Habit' }).click();
      await expect(page.getByRole('alertdialog')).toBeVisible();
      await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
      await expect(page.getByRole('alertdialog')).not.toBeVisible();
    });
  });

  // ── Delete habit (has entries) ────────────────────────────────────────────

  test.describe('Delete habit (has entries)', () => {
    test('alert dialog shows block message and Delete button is disabled', async ({ page }) => {
      // Create a habit via the UI.
      await page.goto('/settings');
      await page.getByRole('button', { name: 'New' }).click();
      await page.getByRole('dialog').getByLabel('Name').fill('Blocked Delete Habit');
      await page.getByRole('combobox', { name: 'Type' }).click();
      await page.getByRole('option', { name: 'Workout' }).click();
      await page.getByRole('button', { name: 'Add habit' }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible();

      // Log an entry to make hasEntries true.
      await openLogDialogForHabit(page, 'Blocked Delete Habit');
      await page.getByLabel('Duration (min)').fill('15');
      await page.getByRole('button', { name: 'Log entry' }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible();

      // Navigate to Settings and open the delete alert dialog.
      await page.goto('/settings');
      await page.getByRole('button', { name: 'Delete Blocked Delete Habit' }).click();

      await expect(page.getByRole('alertdialog')).toBeVisible();

      // The description should explain why deletion is blocked.
      await expect(
        page.getByText('This habit has logged entries and cannot be deleted.'),
      ).toBeVisible();

      // The Delete button must be disabled.
      await expect(
        page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }),
      ).toBeDisabled();
    });

    test('Cancel button in the blocked delete dialog closes it and keeps the habit', async ({
      page,
    }) => {
      // Navigate to settings — "Blocked Delete Habit" still exists from the previous test.
      await page.goto('/settings');

      await page.getByRole('button', { name: 'Delete Blocked Delete Habit' }).click();
      await expect(page.getByRole('alertdialog')).toBeVisible();

      await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel' }).click();

      await expect(page.getByRole('alertdialog')).not.toBeVisible();
      // The habit is still present.
      await expect(page.getByText('Blocked Delete Habit')).toBeVisible();
    });
  });
});
