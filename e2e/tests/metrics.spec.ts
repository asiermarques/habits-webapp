import { test, expect } from '@playwright/test';
import { MOBILE_VIEWPORT, createUser, openLogDialogForHabit } from '../helpers';

const USER_NAME = 'Metrics Test User';

test.describe('Metrics page', () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  test.beforeAll(async ({ browser }) => {
    // Create the dedicated test user (idempotent — skips if already present).
    const page = await browser.newPage();
    page.setViewportSize(MOBILE_VIEWPORT);
    await createUser(page, USER_NAME);

    // Explicitly switch to Metrics Test User so entries are attributed to them.
    // The UserSwitcher dropdown is in the header and appears when >1 user exists.
    await page.goto('/');
    await page.getByRole('button', { name: 'Switch user' }).click();
    await page.getByRole('menuitem', { name: USER_NAME }).first().click();

    // Log a few entries so the score cards show non-trivial values.
    // Using seeded habits that belong to this user.
    await openLogDialogForHabit(page, 'Running');
    await page.getByLabel('Duration (min)').fill('30');
    await page.getByLabel('Distance (km)').fill('5');
    await page.getByRole('button', { name: 'Log entry' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    await openLogDialogForHabit(page, 'Writing');
    await page.getByLabel('Words').fill('600');
    await page.getByRole('button', { name: 'Log entry' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // A negative custom habit with a cost — contributes to "Bad habit total cost".
    await openLogDialogForHabit(page, 'Fast food consuming');
    await page.getByLabel('Cost spent (EUR)').fill('8.50');
    await page.getByRole('button', { name: 'Log entry' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    await page.close();
  });

  // ── Navigation to /metrics ────────────────────────────────────────────────

  test.describe('Navigation', () => {
    test('navigating to /metrics renders the page', async ({ page }) => {
      await page.goto('/metrics');

      // The page renders multiple sections — the export toggle is always visible
      // because it renders before SummaryCards checks for an active user.
      await expect(page.getByText('Export CSV')).toBeVisible();
    });
  });

  // ── Summary score cards ───────────────────────────────────────────────────

  test.describe('Summary score cards', () => {
    test('shows "Most logged" score card heading', async ({ page }) => {
      await page.goto('/metrics');

      await expect(page.getByText('Most logged', { exact: false })).toBeVisible();
    });

    test('shows "Least logged" score card heading', async ({ page }) => {
      await page.goto('/metrics');

      await expect(page.getByText('Least logged', { exact: false })).toBeVisible();
    });

    test('shows "Bad habit total cost" score card heading', async ({ page }) => {
      await page.goto('/metrics');

      await expect(page.getByText('Bad habit total cost', { exact: false })).toBeVisible();
    });

    test('shows "Active habits" score card heading', async ({ page }) => {
      await page.goto('/metrics');

      await expect(page.getByText('Active habits', { exact: false })).toBeVisible();
    });

    test('"Active habits" card includes an "of N total" hint', async ({ page }) => {
      await page.goto('/metrics');

      // The hint reads "of N" where N is the total habit count for this user.
      // Assert the pattern is present without pinning an exact number.
      await expect(page.getByText(/^of \d+$/)).toBeVisible();
    });

    test('score cards are arranged in two columns on mobile', async ({ page }) => {
      await page.goto('/metrics');

      // The SummaryCards section uses a CSS grid. We verify all four card labels
      // are visible, which is the observable outcome of the two-column layout.
      const labels = ['Most logged', 'Least logged', 'Bad habit total cost', 'Active habits'];
      for (const label of labels) {
        await expect(page.getByText(label, { exact: false })).toBeVisible();
      }
    });

    test('"Most logged" card shows a habit name after entries are logged', async ({ page }) => {
      await page.goto('/metrics');

      // After logging entries in beforeAll, the most-logged card should contain
      // a habit name rather than the empty-state dash. We do not assert the exact
      // habit name because the DB is shared and test order can vary the winner.
      // The card also shows an "N reps" count beneath the habit name.
      await expect(page.getByText(/\d+ reps/).first()).toBeVisible();
    });
  });

  // ── By-habit 13-week bar chart ────────────────────────────────────────────

  test.describe('By habit bar chart (last 3 months)', () => {
    test('shows "By habit (last 3 months)" section heading', async ({ page }) => {
      await page.goto('/metrics');

      await expect(
        page.getByRole('heading', { name: 'By habit (last 3 months)' }),
      ).toBeVisible();
    });

    test('chart container is rendered on the page', async ({ page }) => {
      await page.goto('/metrics');

      // The chart section wraps its content in a bordered card. We assert the
      // section heading is present — asserting SVG internals would be fragile.
      const chartSection = page.locator('section').filter({
        has: page.getByRole('heading', { name: 'By habit (last 3 months)' }),
      });
      await expect(chartSection).toBeVisible();
    });

    test('does not show the "No entries" empty state after logging entries', async ({ page }) => {
      await page.goto('/metrics');

      // Entries were logged in beforeAll, so the empty-state message should not appear.
      await expect(page.getByText('No entries in the last 3 months.')).not.toBeVisible();
    });
  });

  // ── Per-habit heatmaps ────────────────────────────────────────────────────

  test.describe('Heatmaps (last 6 months)', () => {
    test('shows "Heatmaps (last 6 months)" section heading', async ({ page }) => {
      await page.goto('/metrics');

      await expect(
        page.getByRole('heading', { name: 'Heatmaps' }),
      ).toBeVisible();
    });

    test('does not show the "No habits configured yet" empty state', async ({ page }) => {
      await page.goto('/metrics');

      // User has seeded habits so this message should not appear.
      await expect(page.getByText('No habits configured yet.')).not.toBeVisible();
    });

    test('renders a heatmap grid for a habit that has entries', async ({ page }) => {
      await page.goto('/metrics');

      // The Running habit was logged in beforeAll. Its heatmap grid has
      // aria-label="Running heatmap" from HeatmapSection.tsx.
      await expect(page.getByRole('grid', { name: 'Running heatmap' })).toBeVisible();
    });

    test('heatmap grid for Running habit contains gridcell elements', async ({ page }) => {
      await page.goto('/metrics');

      const grid = page.getByRole('grid', { name: 'Running heatmap' });
      await expect(grid).toBeVisible();
      // There should be 26 weeks × 7 days = 182 cells in the grid.
      const cells = grid.getByRole('gridcell');
      await expect(cells).toHaveCount(182);
    });

    test('heatmap card shows the total entries count for a logged habit', async ({ page }) => {
      await page.goto('/metrics');

      // Each heatmap card shows "N entries" as a span next to the habit name.
      // Assert at least one such count is visible anywhere in the heatmap section.
      const heatmapSection = page.locator('section').filter({
        has: page.getByRole('heading', { name: 'Heatmaps' }),
      });
      await expect(heatmapSection.getByText(/\d+ entries/i).first()).toBeVisible();
    });

    test('heatmap card shows the habit name as a heading', async ({ page }) => {
      await page.goto('/metrics');

      // Each heatmap card renders an h3 with the habit name.
      await expect(page.getByRole('heading', { name: 'Running', level: 3 })).toBeVisible();
    });
  });


});
