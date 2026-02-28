import { test, expect } from '@playwright/test';
import { loginAdmin } from './helpers.js';

test.describe('Season Restrictions Edit Page', () => {
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
    const firstSeasonLink = page.locator('a[href*="/admin/seasons/"]').first();
    await expect(firstSeasonLink).toBeVisible({ timeout: 10000 });
    const href = await firstSeasonLink.getAttribute('href');
    const match = href?.match(/\/admin\/seasons\/([^\/]+)/);
    return match?.[1];
  }

  test('loads edit page and core sections', async ({ page }) => {
    const seasonId = await getFirstSeasonId(page);
    test.skip(!seasonId, 'No season available');

    await page.goto(`/admin/seasons/${seasonId}/restrictions/edit`, {
      waitUntil: 'networkidle',
    });

    await expect(page.getByRole('heading', { name: /Editar Restricciones/i })).toBeVisible();
    await expect(page.getByText('1) Select Players')).toBeVisible();
    await expect(page.getByText('2) Select Cards')).toBeVisible();
    await expect(page.getByText('3) Add Reason')).toBeVisible();
    await expect(page.getByText('4) Preview')).toBeVisible();
  });

  test('shows validation error when applying without selections', async ({ page }) => {
    const seasonId = await getFirstSeasonId(page);
    test.skip(!seasonId, 'No season available');

    await page.goto(`/admin/seasons/${seasonId}/restrictions/edit`, {
      waitUntil: 'networkidle',
    });

    await page.getByRole('button', { name: /Apply Restrictions/i }).click();
    await expect(page.getByText('Select at least one player')).toBeVisible();
  });

  test('accepts reason input and updates counter', async ({ page }) => {
    const seasonId = await getFirstSeasonId(page);
    test.skip(!seasonId, 'No season available');

    await page.goto(`/admin/seasons/${seasonId}/restrictions/edit`, {
      waitUntil: 'networkidle',
    });

    const textarea = page.getByPlaceholder(/Custom reason/i);
    await textarea.fill('Fair play test reason');
    await expect(page.getByText('21 / 500')).toBeVisible();
  });

  test('shows preview guidance when no selections', async ({ page }) => {
    const seasonId = await getFirstSeasonId(page);
    test.skip(!seasonId, 'No season available');

    await page.goto(`/admin/seasons/${seasonId}/restrictions/edit`, {
      waitUntil: 'networkidle',
    });

    await expect(
      page.getByText(/Select at least one player and one card to generate preview matrix/i)
    ).toBeVisible();
  });

  test('loads PlayerMultiSelect without console errors', async ({ page }) => {
    const seasonId = await getFirstSeasonId(page);
    test.skip(!seasonId, 'No season available');

    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    const pageErrors = [];
    page.on('pageerror', (error) => {
      pageErrors.push(error.message);
    });

    await page.goto(`/admin/seasons/${seasonId}/restrictions/edit`, {
      waitUntil: 'networkidle',
    });

    // Wait for PlayerMultiSelect to attempt loading players
    await page.waitForTimeout(2000);

    // Check that Retry button is NOT visible (would indicate an error)
    const retryButton = page.getByRole('button', { name: /Retry/i });
    await expect(retryButton).not.toBeVisible();

    // Filter out known non-critical errors (e.g., favicon 404)
    const criticalErrors = consoleErrors.filter(
      (err) => !err.includes('favicon') && !err.includes('404')
    );
    const criticalPageErrors = pageErrors.filter(
      (err) => !err.includes('favicon') && !err.includes('404')
    );

    // Assert no critical console or page errors
    expect(criticalErrors, `Console errors detected: ${criticalErrors.join(', ')}`).toHaveLength(0);
    expect(criticalPageErrors, `Page errors detected: ${criticalPageErrors.join(', ')}`).toHaveLength(0);

    // Verify players loaded successfully
    await expect(page.getByText(/Select players/i)).toBeVisible();
  });
});
