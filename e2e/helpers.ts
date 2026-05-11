import { expect, type Page } from '@playwright/test';

export const MOBILE_VIEWPORT = { width: 375, height: 812 };

const BACKEND_URL = 'http://localhost:4001';

export async function createUser(page: Page, name: string) {
  await page.goto('/settings');
  // Skip if the user already exists (handles server-reuse between runs).
  const existing = page.getByRole('listitem').filter({ hasText: new RegExp(`^${name}`) });
  if (await existing.first().isVisible({ timeout: 1000 }).catch(() => false)) return;
  await page.getByLabel('New user name').fill(name);
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(existing.first()).toBeVisible();
}

export async function openLogDialogForHabit(page: Page, habitName: string) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Log entry' }).click();
  const habitTrigger = page.getByRole('combobox', { name: 'Habit' });
  await expect(habitTrigger).toBeVisible();
  await habitTrigger.click();
  await page.getByRole('option', { name: habitName }).click();
}

// Radix renders a custom dropdown, not a native <select>, so we click the
// combobox trigger then click the option by its visible text.
export async function selectCurrency(page: Page, code: string) {
  const trigger = page.getByRole('combobox', { name: 'Currency' });
  await trigger.click();
  await page.getByRole('option', { name: code }).click();
}

export async function resetCurrencyToEur(page: Page) {
  await page.request.put(`${BACKEND_URL}/settings/currency`, {
    data: { currency: 'EUR' },
  });
}
