import { test, expect } from '@playwright/test';
import { MOBILE_VIEWPORT, createUser } from '../helpers';

test.describe('CSV export feature', () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await createUser(page, 'CSV Export Test User');
    await page.close();
  });

  // ── CSV export ────────────────────────────────────────────────────────────

  test('shows "Export CSV" toggle button at the top of the metrics page', async ({ page }) => {
    await page.goto('/metrics');

    await expect(
      page.getByRole('button', { name: /Export CSV/i }),
    ).toBeVisible();
  });

  test('"Export CSV" toggle is collapsed by default (form not visible)', async ({ page }) => {
    await page.goto('/metrics');

    // The panel is hidden until the toggle is clicked.
    // The "From" label only exists inside the expanded panel.
    await expect(page.getByLabel('From')).not.toBeVisible();
    await expect(page.getByLabel('To', { exact: true })).not.toBeVisible();
  });

  test('clicking the toggle expands the export panel', async ({ page }) => {
    await page.goto('/metrics');

    await page.getByRole('button', { name: /Export CSV/i }).click();

    await expect(page.getByLabel('From')).toBeVisible();
    await expect(page.getByLabel('To', { exact: true })).toBeVisible();
  });

  test('expanded panel shows the "Export" submit button', async ({ page }) => {
    await page.goto('/metrics');

    await page.getByRole('button', { name: /Export CSV/i }).click();

    await expect(page.getByRole('button', { name: 'Export', exact: true })).toBeVisible();
  });

  test('expanded panel shows From and To date fields with pre-filled values', async ({ page }) => {
    await page.goto('/metrics');

    await page.getByRole('button', { name: /Export CSV/i }).click();

    const fromValue = await page.getByLabel('From').getAttribute('data-value');
    const toValue = await page.getByLabel('To', { exact: true }).getAttribute('data-value');
    expect(fromValue).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(toValue).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('clicking the toggle again collapses the export panel', async ({ page }) => {
    await page.goto('/metrics');

    const toggleButton = page.getByRole('button', { name: /Export CSV/i });
    await toggleButton.click();
    await expect(page.getByLabel('From')).toBeVisible();

    await toggleButton.click();
    await expect(page.getByLabel('From')).not.toBeVisible();
  });

  test('clicking Export triggers a file download', async ({ page }) => {
    await page.goto('/metrics');

    await page.getByRole('button', { name: /Export CSV/i }).click();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export', exact: true }).click(),
    ]);

    expect(download).toBeTruthy();
  });

  test('downloaded file has a csv filename with the user slug and date range', async ({ page }) => {
    await page.goto('/metrics');

    await page.getByRole('button', { name: /Export CSV/i }).click();

    const from = await page.getByLabel('From').getAttribute('data-value');
    const to = await page.getByLabel('To', { exact: true }).getAttribute('data-value');

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export', exact: true }).click(),
    ]);

    const filename = download.suggestedFilename();
    expect(filename).toMatch(/^habits-.+-\d{4}-\d{2}-\d{2}-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(filename).toContain(from);
    expect(filename).toContain(to);
  });
});
