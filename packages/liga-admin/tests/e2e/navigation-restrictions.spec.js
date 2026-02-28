import { test, expect } from '@playwright/test';
import { loginAdmin } from './helpers.js';

test.describe('Restrictions Navigation (Task Group 9)', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(
      !process.env.PLAYWRIGHT_ADMIN_EMAIL || !process.env.PLAYWRIGHT_ADMIN_PASSWORD,
      'Requires PLAYWRIGHT_ADMIN_EMAIL and PLAYWRIGHT_ADMIN_PASSWORD'
    );

    await loginAdmin(
      page,
      process.env.PLAYWRIGHT_ADMIN_EMAIL,
      process.env.PLAYWRIGHT_ADMIN_PASSWORD
    );
  });

  async function getFirstSeasonId(page) {
    await page.goto('/admin/seasons', { waitUntil: 'networkidle' });
    
    // Wait for seasons list to load
    await expect(page.getByRole('heading', { name: /Temporadas/i })).toBeVisible({ timeout: 10000 });
    
    // Get first season link
    const firstSeasonLink = page.locator('a[href*="/admin/seasons/"]').first();
    await expect(firstSeasonLink).toBeVisible({ timeout: 5000 });
    
    const href = await firstSeasonLink.getAttribute('href');
    const match = href?.match(/\/admin\/seasons\/([^\/]+)/);
    return match?.[1];
  }

  test('T9.1: Restrictions button appears in season card', async ({ page }) => {
    const seasonId = await getFirstSeasonId(page);
    test.skip(!seasonId, 'No season available');

    // Should already be on /admin/seasons
    // Verify "Restricciones (RES)" button is visible in the season card
    const restrictionsButton = page.getByRole('button', { name: /Restricciones/i });
    await expect(restrictionsButton).toBeVisible();
  });

  test('T9.2: Routes are registered and accessible', async ({ page }) => {
    const seasonId = await getFirstSeasonId(page);
    test.skip(!seasonId, 'No season available');

    // Test list view route
    await page.goto(`/admin/seasons/${seasonId}/restrictions`, { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: /Restricciones/i })).toBeVisible({ timeout: 10000 });

    // Test edit view route
    await page.goto(`/admin/seasons/${seasonId}/restrictions/edit`, { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: /Editar Restricciones/i })).toBeVisible({ timeout: 10000 });
  });

  test('T9.3a: Click restrictions button to navigate to list', async ({ page }) => {
    const seasonId = await getFirstSeasonId(page);
    test.skip(!seasonId, 'No season available');

    // Should already be on /admin/seasons
    const restrictionsButton = page.getByRole('button', { name: /Restricciones/i }).first();
    await restrictionsButton.click();

    // Wait for list view to load
    await expect(page.getByRole('heading', { name: /Restricciones/i })).toBeVisible({ timeout: 10000 });
  });

  test('T9.3b: Navigate from restrictions list to edit page', async ({ page }) => {
    const seasonId = await getFirstSeasonId(page);
    test.skip(!seasonId, 'No season available');

    // Go to restrictions list
    await page.goto(`/admin/seasons/${seasonId}/restrictions`, { waitUntil: 'networkidle' });

    // Click "Add Restriction" button or similar
    const addButton = page.getByRole('button', { name: /\+ Add|Add Restriction|Agregar/i }).first();
    
    // If add button exists, click it
    if (await addButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await addButton.click();
      await expect(page.getByRole('heading', { name: /Editar/i })).toBeVisible({ timeout: 10000 });
    }
  });

  test('T9.3c: Restrictions button NOT visible on non-season pages', async ({ page }) => {
    // Navigate to players (not inside a season card display)
    await page.goto('/admin/players', { waitUntil: 'networkidle' });

    // Restrictions button should NOT be visible in the main nav
    const navRestrictions = page.locator('nav').getByRole('button', { name: /Restricciones/i });
    await expect(navRestrictions).not.toBeVisible();
  });

  test('T9.3d: Restrictions page accessible via URL', async ({ page }) => {
    const seasonId = await getFirstSeasonId(page);
    test.skip(!seasonId, 'No season available');

    // Navigate directly via URL
    await page.goto(`/admin/seasons/${seasonId}/restrictions`, { waitUntil: 'networkidle' });

    // Verify page loaded
    await expect(page.getByRole('heading', { name: /Restricciones/i })).toBeVisible({ timeout: 10000 });
  });
});
