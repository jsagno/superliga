// helpers.js para Playwright: login util

/**
 * Realiza login en la app admin usando Playwright
 * Ensures complete authentication and page load before returning
 * @param {import('@playwright/test').Page} page
 * @param {string} email
 * @param {string} password
 */
export async function loginAdmin(page, email, password) {
  // Navigate to login page
  await page.goto('/admin/login', { waitUntil: 'networkidle' });
  
  // Wait for login form to be fully loaded
  await page.waitForSelector('input[placeholder*="nombre"]', { state: 'visible', timeout: 10000 });
  
  // Fill email/username field
  await page.locator('input[placeholder*="nombre"]').fill(email);
  
  // Fill password field
  await page.locator('input[type="password"]').fill(password);
  
  // Click login button and wait for navigation to complete
  await Promise.all([
    page.waitForURL(/\/admin/, { timeout: 15000, waitUntil: 'networkidle' }),
    page.locator('button:has-text("Iniciar Sesión")').click(),
  ]);
  
  // Wait for the authenticated admin layout header to be visible
  // This confirms we're on a protected route with active session
  await page.getByText('Liga Admin').waitFor({ state: 'visible', timeout: 10000 });
  
  // Wait for navigation links to be interactive (confirms layout is ready)
  await page.getByRole('link', { name: 'Dashboard' }).waitFor({ state: 'visible', timeout: 5000 });
  
  // Small delay to ensure session is fully established
  await page.waitForTimeout(1000);
}
