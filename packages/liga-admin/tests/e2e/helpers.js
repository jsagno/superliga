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
  
  // Click login button
  await page.locator('button:has-text("Iniciar Sesión")').click();
  
  // Wait for redirect to admin area
  await page.waitForURL(/\/admin/, { timeout: 10000 });
}
