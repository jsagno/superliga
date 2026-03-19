import { test, expect } from '@playwright/test';

test('Root redirects to admin login', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/admin\/login/);
  await expect(page.getByRole('heading', { name: /Administración/i })).toBeVisible();
});