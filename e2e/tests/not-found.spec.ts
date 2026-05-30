import { test, expect } from '@playwright/test';

test.describe('Not found (404)', () => {
  test('shows the 404 page for unknown routes and links back home', async ({ page }) => {
    await page.goto('/this-route-does-not-exist');

    // Copy is localized (en/es); match either.
    await expect(
      page.getByRole('heading', { name: /nothing here|aquí no hay nada/i }),
    ).toBeVisible();

    await page.getByRole('link', { name: /back home|volver al inicio/i }).click();
    await expect(page).toHaveURL('/');
  });
});
