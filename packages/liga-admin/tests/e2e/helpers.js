// helpers.js para Playwright: login util

/**
 * Realiza login en la app admin usando Playwright
 * @param {import('@playwright/test').Page} page
 * @param {string} email
 * @param {string} password
 */
export async function loginAdmin(page, email, password) {
  await page.goto('/admin/login');
  
  // Wait for login form to be visible
  await page.waitForSelector('input[placeholder*="nombre"]', { timeout: 10000 });
  
  // Fill email/username field (first textbox)
  await page.locator('input[placeholder*="nombre"]').fill(email);
  
  // Fill password field
  await page.locator('input[type="password"]').fill(password);
  
  // Click login button and wait for navigation simultaneously
  await Promise.all([
    page.waitForNavigation({ url: /\/admin/, waitUntil: 'domcontentloaded', timeout: 15000 }),
    page.locator('button:has-text("Iniciar Sesión")').click()
  ]);
  
  // Verify we're on the admin page by checking for the navigation header
  await page.waitForSelector('text=Liga Admin', { timeout: 5000 });
}
