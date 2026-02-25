// helpers.js para Playwright: login util

/**
 * Realiza login en la app admin usando Playwright
 * @param {import('@playwright/test').Page} page
 * @param {string} email
 * @param {string} password
 */
export async function loginAdmin(page, email, password) {
  await page.goto('/admin/login');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  // Espera a que redirija a dashboard o players
  await page.waitForURL(/\/admin\/(dashboard|players)/);
}
