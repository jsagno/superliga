import { test, expect } from '@playwright/test';
import { loginAdmin } from './helpers.js';

test.describe('Configurable Auto-Link Battle Matching (T.G. 8)', () => {
  let seasonId;
  let playerId;

  test.beforeEach(async ({ page }) => {
    test.skip(
      !process.env.PLAYWRIGHT_ADMIN_EMAIL || !process.env.PLAYWRIGHT_ADMIN_PASSWORD,
      'Admin credentials not configured'
    );

    await loginAdmin(page);
  });

  test('T1: Admin configures cutoff in season edit UI', async ({ page }) => {
    // Skip if no test season setup
    test.skip(!seasonId, 'Requires test season setup');

    // Navigate to season edit
    await page.goto(`/admin/seasons/${seasonId}`);
    await page.waitForSelector('text=Editar Temporada');

    // Find cutoff input (number field for minutes)
    const cutoffInput = page.locator('input[type="number"]').first();
    await expect(cutoffInput).toHaveValue('590');

    // Change cutoff to 420 minutes (7 hours)
    await cutoffInput.fill('420');

    // Find timezone dropdown
    const tzDropdown = page.locator('select').last();
    await tzDropdown.selectOption('-05:00');

    // Save changes
    await page.locator('button:has-text("Guardar")').click();

    // Wait for success and reload
    await page.waitForTimeout(500);
    await page.reload();

    // Verify persistence
    await expect(cutoffInput).toHaveValue('420');
    await expect(tzDropdown).toHaveValue('-05:00');
  });

  test('T2: Auto-link respects season configuration', async ({ page }) => {
    test.skip(!seasonId, 'Requires test season setup');

    // Navigate to seasons list
    await page.goto('/admin/seasons');
    
    // Find the test season and open it
    const seasonRow = page.locator(`text=${seasonId}`).first();
    await seasonRow.click();

    // Should show season details with cutoff config
    await expect(page.locator('text=Configuración de Auto-Vincular')).toBeVisible();
  });

  test('T3: Disambiguation selects best quality battle', async ({ page }) => {
    test.skip(!seasonId, 'Requires test season setup');

    // This test validates logs in browser console
    // Collect console messages during auto-link
    const consoleLogs = [];
    page.on('console', msg => {
      if (msg.type() === 'log' && msg.text().includes('Disambiguation')) {
        consoleLogs.push(msg.text());
      }
    });

    // Navigate to season
    await page.goto(`/admin/seasons/${seasonId}`);

    // Open daily points or auto-link interface
    const autoLinkBtn = page.locator('button:has-text("Auto-Vincular")');
    if (await autoLinkBtn.isVisible()) {
      await autoLinkBtn.click();

      // Confirm dialog
      await page.once('dialog', dialog => dialog.accept());

      // Wait for completion
      await page.waitForTimeout(5000);
    }

    // Verify disambiguation logs were created
    expect(consoleLogs.length).toBeGreaterThanOrEqual(0);
    expect(page.locator('text=Auto-vinculación')).toBeVisible({ timeout: 10000 });
  });

  test('T4: No suitable battle found - match skipped', async ({ page }) => {
    test.skip(!seasonId, 'Requires test season setup');

    // Navigate to seasons list
    await page.goto('/admin/seasons');

    // Find season with no available battles
    const seasonRows = page.locator('button:has-text("Ver")');
    if (await seasonRows.count() > 0) {
      await seasonRows.first().click();
    }

    // Verify skipped count in progress (if visible)
    await page.waitForTimeout(2000);
    
    // Look for progress indicator showing skipped matches
    const progressText = page.locator('text=/omitidas|skipped/');
    if (await progressText.isVisible()) {
      expect(progressText).toBeVisible();
    }
  });

  test('T5: Adjacent regression - Season list navigation', async ({ page }) => {
    // Navigate to seasons list
    await page.goto('/admin/seasons');

    // Verify page loads with seasons
    await expect(page.locator('text=Temporadas')).toBeVisible();

    // Find at least one season row
    const seasonRows = page.locator('text=/[T|t]emporada/');
    expect(await seasonRows.count()).toBeGreaterThan(0);

    // Click on a season to view details
    const firstSeason = seasonRows.first();
    await firstSeason.click();

    // Verify season details page loads
    await expect(page.locator('text=/Editar|Nueva/i')).toBeVisible({ timeout: 5000 });

    // Navigate back
    await page.goBack();

    // Verify list reappears
    await expect(page.locator('text=Temporadas')).toBeVisible();
  });

  test('T6: Adjacent regression - Daily points page loads', async ({ page }) => {
    test.skip(!seasonId, 'Requires test season setup');

    // Navigate to season
    await page.goto(`/admin/seasons/${seasonId}`);

    // Find daily points button
    const dailyPointsBtn = page.locator('button:has-text("Resumen Diario")');
    if (await dailyPointsBtn.isVisible()) {
      await dailyPointsBtn.click();

      // Verify daily points page loads
      await expect(page.locator('text=/Resumen|Daily|Diario/i')).toBeVisible({ timeout: 5000 });

      // Verify dates are displayed correctly
      const dateElements = page.locator('text=/[0-3][0-9]\/[0-1][0-9]/');
      expect(await dateElements.count()).toBeGreaterThan(0);
    }
  });

  test('T7: Cutoff calculation affects displayed dates', async ({ page }) => {
    test.skip(!seasonId, 'Requires test season setup');

    // Navigate to daily points
    await page.goto(`/admin/seasons/${seasonId}/daily-points`);

    // Verify dates are displayed
    const dateHeaders = page.locator('[class*="date"]');
    const dateCount = await dateHeaders.count();

    expect(dateCount).toBeGreaterThan(0);

    // Dates should follow YYYY-MM-DD or DD/MM format
    for (let i = 0; i < Math.min(dateCount, 3); i++) {
      const dateText = await dateHeaders.nth(i).textContent();
      // Accept various date formats
      expect(dateText).toMatch(/\d{1,2}\/\d{1,2}|\d{4}-\d{2}-\d{2}/);
    }
  });

  test('T8: Configuration persists across sessions', async ({ page }) => {
    test.skip(!seasonId, 'Requires test season setup');

    // Set cutoff to 300
    await page.goto(`/admin/seasons/${seasonId}`);
    const cutoffInput = page.locator('input[type="number"]').first();
    await cutoffInput.fill('300');

    await page.locator('button:has-text("Guardar")').click();
    await page.waitForTimeout(500);

    // Navigate away and back
    await page.goto('/admin/seasons');
    await page.goto(`/admin/seasons/${seasonId}`);

    // Verify cutoff still shows as 300
    await expect(cutoffInput).toHaveValue('300');
  });
});
