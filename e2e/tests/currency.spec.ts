import { test, expect } from '@playwright/test';
import {
  MOBILE_VIEWPORT,
  createUser,
  openLogDialogForHabit,
  selectCurrency,
  resetCurrencyToEur,
} from '../helpers';

const SUPPORTED_CURRENCIES = ['EUR', 'USD', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD'] as const;

test.describe('Currency feature', () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    page.setViewportSize(MOBILE_VIEWPORT);
    await createUser(page, 'Currency Test User');
    await page.close();
  });

  // ── Settings page ──────────────────────────────────────────────────────────

  test.describe('Settings page — Currency section', () => {
    test('shows a Currency section with a heading and description', async ({ page }) => {
      await page.goto('/settings');

      await expect(page.getByRole('heading', { name: 'Currency' })).toBeVisible();
      await expect(
        page.getByText('Used for displaying the "Cost spent" amount on bad habits.'),
      ).toBeVisible();
    });

    test('shows a currency combobox', async ({ page }) => {
      await page.goto('/settings');

      await expect(page.getByRole('combobox', { name: 'Currency' })).toBeVisible();
    });

    test('defaults to EUR', async ({ page }) => {
      await page.goto('/settings');

      await expect(page.getByRole('combobox', { name: 'Currency' })).toHaveText(/EUR/);
    });

    test('dropdown contains all supported currency codes', async ({ page }) => {
      await page.goto('/settings');

      await page.getByRole('combobox', { name: 'Currency' }).click();

      for (const code of SUPPORTED_CURRENCIES) {
        await expect(page.getByRole('option', { name: code })).toBeVisible();
      }

      await page.keyboard.press('Escape');
    });

    test('selecting USD updates the displayed value to USD', async ({ page }) => {
      await page.goto('/settings');
      await selectCurrency(page, 'USD');

      await expect(page.getByRole('combobox', { name: 'Currency' })).toHaveText(/USD/);

      await resetCurrencyToEur(page);
    });

    test('currency selection persists across page reloads', async ({ page }) => {
      await page.goto('/settings');
      await selectCurrency(page, 'GBP');

      await page.reload();

      await expect(page.getByRole('combobox', { name: 'Currency' })).toHaveText(/GBP/);

      await resetCurrencyToEur(page);
    });
  });

  // ── Entry form label ───────────────────────────────────────────────────────

  test.describe('Log entry form — Cost spent label', () => {
    test('shows "Cost spent (EUR)" label for a negative custom habit when currency is EUR', async ({
      page,
    }) => {
      await openLogDialogForHabit(page, 'Fast food consuming');

      await expect(page.getByText('Cost spent (EUR)')).toBeVisible();
    });

    test('shows "Cost spent (USD)" label after switching currency to USD', async ({ page }) => {
      await page.goto('/settings');
      await selectCurrency(page, 'USD');

      await openLogDialogForHabit(page, 'Fast food consuming');

      await expect(page.getByText('Cost spent (USD)')).toBeVisible();

      await resetCurrencyToEur(page);
    });

    test('shows "Cost spent" label for all custom habits regardless of positive flag', async ({
      page,
    }) => {
      // EntryForm renders the Cost spent field for every custom habit; the positive flag
      // only affects metrics aggregation, not form fields.
      await openLogDialogForHabit(page, 'Reading');

      await expect(page.getByText(/Cost spent \(EUR\)/)).toBeVisible();
    });
  });

  // ── Entry summary in the entries list ─────────────────────────────────────

  test.describe('Entries list — cost display in entry cards', () => {
    test('entry card for a negative custom habit with an amount shows cost formatted with EUR', async ({
      page,
    }) => {
      await openLogDialogForHabit(page, 'Meat consuming');

      await page.getByLabel('Cost spent (EUR)').fill('12.50');
      await page.getByRole('button', { name: 'Log entry' }).click();

      // Wait for dialog to close before asserting on entry card.
      // Asserting on habit name would hit both the Radix visible span and its hidden native <option>.
      await expect(page.getByRole('dialog')).not.toBeVisible();
      await expect(page.getByText(/cost 12\.5 EUR/)).toBeVisible();
    });

    test('entry card cost updates to new currency code after currency change', async ({ page }) => {
      await openLogDialogForHabit(page, 'Fast food consuming');

      await page.getByLabel('Cost spent (EUR)').fill('5');
      await page.getByRole('button', { name: 'Log entry' }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible();

      await page.goto('/settings');
      await selectCurrency(page, 'JPY');

      await page.goto('/');
      await expect(page.getByText(/cost 5 JPY/)).toBeVisible();

      await resetCurrencyToEur(page);
    });
  });

  // ── Score card on Metrics page ────────────────────────────────────────────

  test.describe('Metrics page — Bad habit total cost score card', () => {
    test('shows "Bad habit total cost" score card', async ({ page }) => {
      await page.goto('/metrics');

      await expect(page.getByText('Bad habit total cost', { exact: false })).toBeVisible();
    });

    test('score card displays the total cost formatted with the selected currency', async ({
      page,
    }) => {
      await page.goto('/settings');
      await selectCurrency(page, 'CAD');

      await page.goto('/metrics');

      await expect(page.getByText('Bad habit total cost', { exact: false })).toBeVisible();
      await expect(page.getByText(/\d+(\.\d+)? CAD/)).toBeVisible();

      await resetCurrencyToEur(page);
    });

    test('score card reverts to EUR formatting after switching back to EUR', async ({ page }) => {
      await page.goto('/settings');
      await selectCurrency(page, 'AUD');

      await page.goto('/settings');
      await selectCurrency(page, 'EUR');

      await page.goto('/metrics');

      await expect(page.getByText(/\d+(\.\d+)? EUR/)).toBeVisible();
    });
  });
});
