import { expect, type Page } from '@playwright/test';

export const MOBILE_VIEWPORT = { width: 375, height: 812 };

export const BACKEND_URL = 'http://localhost:4001';

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

// A fresh page has no active-user selection in localStorage, so it falls back
// to whichever user is `isDefault` — typically the very first user created
// across the whole suite run, not necessarily the one this test created. Call
// this before interacting with anything user-scoped whenever the test asserts
// against a specific named user (e.g. via a direct API call), rather than
// relying on "some user with the expected seeded habits" being good enough.
export async function switchToUser(page: Page, name: string) {
  await page.goto('/');
  // The switcher only renders once 2+ users exist (with a single user in the
  // whole DB the default fallback already picks the right one) — checked via
  // a direct API call rather than a UI visibility poll, which under a full
  // suite run can race the header's own users query and silently skip the
  // switch, leaving the wrong user active.
  const usersRes = await page.request.get(`${BACKEND_URL}/api/users`);
  const users = (await usersRes.json()) as { id: number; name: string }[];
  if (users.length < 2) return;

  await page.getByRole('button', { name: 'Switch user' }).click();
  await page.getByRole('menuitem', { name }).click();
}

// Radix renders a custom dropdown, not a native <select>, so we click the
// combobox trigger then click the option by its visible text.
export async function selectCurrency(page: Page, code: string) {
  const trigger = page.getByRole('combobox', { name: 'Currency' });
  await trigger.click();
  await page.getByRole('option', { name: code }).click();
}

export async function resetCurrencyToEur(page: Page) {
  await page.request.put(`${BACKEND_URL}/api/settings/currency`, {
    data: { currency: 'EUR' },
  });
}
