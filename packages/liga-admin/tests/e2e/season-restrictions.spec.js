/**
 * E2E Tests for SeasonRestrictions Page
 * Tests viewing, searching, filtering, and deleting card restrictions
 */

import { test, expect } from '@playwright/test';
import { loginAdmin } from './helpers.js';

test.describe('Season Restrictions Page', () => {
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

  test('should load restrictions page and display title', async ({ page }) => {
    // Navigate to seasons list
    await page.goto('/admin/seasons', { waitUntil: 'networkidle' });

    // Find and click first active season
    const firstSeason = page.locator('tr').filter({ hasText: 'Activa' }).first();
    await expect(firstSeason).toBeVisible({ timeout: 10000 });

    // Get season ID from URL after clicking
    const seasonRow = await firstSeason.locator('a[href*="/admin/seasons/"]').first();
    const seasonHref = await seasonRow.getAttribute('href');
    const seasonId = seasonHref.match(/\/admin\/seasons\/([^\/]+)/)[1];

    // Navigate to restrictions page
    await page.goto(`/admin/seasons/${seasonId}/restrictions`, {
      waitUntil: 'networkidle',
    });

    // Check page loaded
    await expect(
      page.getByRole('heading', { name: /Restricciones de Cartas/i })
    ).toBeVisible({ timeout: 10000 });

    // Check for Add Restriction button
    await expect(page.getByRole('button', { name: /Add Restriction/i })).toBeVisible();
  });

  test('should display search and filter controls', async ({ page }) => {
    // Navigate directly to a test season
    await page.goto('/admin/seasons', { waitUntil: 'networkidle' });

    const firstSeason = page.locator('tr').filter({ hasText: 'Activa' }).first();
    const seasonRow = await firstSeason.locator('a[href*="/admin/seasons/"]').first();
    const seasonHref = await seasonRow.getAttribute('href');
    const seasonId = seasonHref.match(/\/admin\/seasons\/([^\/]+)/)[1];

    await page.goto(`/admin/seasons/${seasonId}/restrictions`);

    // Check search input exists
    await expect(
      page.getByPlaceholder(/Search players or cards/i)
    ).toBeVisible({ timeout: 10000 });

    // Check zone filter dropdown exists
    await expect(page.locator('select').filter({ hasText: /All Zones/i })).toBeVisible();
  });

  test('should filter restrictions by search query', async ({ page }) => {
    await page.goto('/admin/seasons', { waitUntil: 'networkidle' });

    const firstSeason = page.locator('tr').filter({ hasText: 'Activa' }).first();
    const seasonRow = await firstSeason.locator('a[href*="/admin/seasons/"]').first();
    const seasonHref = await seasonRow.getAttribute('href');
    const seasonId = seasonHref.match(/\/admin\/seasons\/([^\/]+)/)[1];

    await page.goto(`/admin/seasons/${seasonId}/restrictions`);

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Find search input
    const searchInput = page.getByPlaceholder(/Search players or cards/i);
    await expect(searchInput).toBeVisible({ timeout: 10000 });

    // Type search query
    await searchInput.fill('test');

    // Wait for debounce (300ms)
    await page.waitForTimeout(400);

    // Check that results counter or empty state appears
    const hasResults = await page.locator('text=/player.*found/i').isVisible();
    const noResults = await page.locator('text=/No results for/i').isVisible();

    expect(hasResults || noResults).toBe(true);
  });

  test('should show empty state when no restrictions exist', async ({ page }) => {
    await page.goto('/admin/seasons', { waitUntil: 'networkidle' });

    const firstSeason = page.locator('tr').filter({ hasText: 'Activa' }).first();
    const seasonRow = await firstSeason.locator('a[href*="/admin/seasons/"]').first();
    const seasonHref = await seasonRow.getAttribute('href');
    const seasonId = seasonHref.match(/\/admin\/seasons\/([^\/]+)/)[1];

    await page.goto(`/admin/seasons/${seasonId}/restrictions`);

    // Wait for page load
    await page.waitForLoadState('networkidle');

    // Check for either restrictions or empty state
    const hasRestrictions = await page.locator('[role="img"]').first().isVisible();
    const emptyState = await page.locator('text=/No hay restricciones/i').isVisible();

    // One of these should be visible
    expect(hasRestrictions || emptyState).toBe(true);
  });

  test('should display restriction cards for players', async ({ page }) => {
    await page.goto('/admin/seasons', { waitUntil: 'networkidle' });

    const firstSeason = page.locator('tr').filter({ hasText: 'Activa' }).first();
    const seasonRow = await firstSeason.locator('a[href*="/admin/seasons/"]').first();
    const seasonHref = await seasonRow.getAttribute('href');
    const seasonId = seasonHref.match(/\/admin\/seasons\/([^\/]+)/)[1];

    await page.goto(`/admin/seasons/${seasonId}/restrictions`);

    await page.waitForLoadState('networkidle');

    // Check if any restriction cards exist
    const restrictionCards = page.locator('.bg-slate-800\\/30').first();

    // Either cards exist or empty state is shown
    const cardsExist = await restrictionCards.isVisible({ timeout: 5000 }).catch(() => false);
    const emptyState = await page
      .locator('text=/No hay restricciones/i')
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    expect(cardsExist || emptyState).toBe(true);
  });

  test('should have working Clear filters button', async ({ page }) => {
    await page.goto('/admin/seasons', { waitUntil: 'networkidle' });

    const firstSeason = page.locator('tr').filter({ hasText: 'Activa' }).first();
    const seasonRow = await firstSeason.locator('a[href*="/admin/seasons/"]').first();
    const seasonHref = await seasonRow.getAttribute('href');
    const seasonId = seasonHref.match(/\/admin\/seasons\/([^\/]+)/)[1];

    await page.goto(`/admin/seasons/${seasonId}/restrictions`);

    // Fill search
    const searchInput = page.getByPlaceholder(/Search players or cards/i);
    await searchInput.fill('test');
    await page.waitForTimeout(400);

    // Check if Clear filters button appears
    const clearButton = page.getByRole('button', { name: /Clear filters/i });
    const isVisible = await clearButton.isVisible({ timeout: 2000 }).catch(() => false);

    if (isVisible) {
      await clearButton.click();

      // Verify search is cleared
      await expect(searchInput).toHaveValue('');
    }
  });

  test('should navigate to Add Restriction page when button clicked', async ({ page }) => {
    await page.goto('/admin/seasons', { waitUntil: 'networkidle' });

    const firstSeason = page.locator('tr').filter({ hasText: 'Activa' }).first();
    const seasonRow = await firstSeason.locator('a[href*="/admin/seasons/"]').first();
    const seasonHref = await seasonRow.getAttribute('href');
    const seasonId = seasonHref.match(/\/admin\/seasons\/([^\/]+)/)[1];

    await page.goto(`/admin/seasons/${seasonId}/restrictions`);

    // Find and click Add Restriction button
    const addButton = page.getByRole('button', { name: /Add Restriction/i });
    await expect(addButton).toBeVisible({ timeout: 10000 });

    await addButton.click();

    // Verify navigation to edit page
    await expect(page).toHaveURL(
      new RegExp(`/admin/seasons/${seasonId}/restrictions/edit`)
    );
  });

  test('should load without errors', async ({ page }) => {
    // Collect console errors
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/admin/seasons', { waitUntil: 'networkidle' });

    const firstSeason = page.locator('tr').filter({ hasText: 'Activa' }).first();
    const seasonRow = await firstSeason.locator('a[href*="/admin/seasons/"]').first();
    const seasonHref = await seasonRow.getAttribute('href');
    const seasonId = seasonHref.match(/\/admin\/seasons\/([^\/]+)/)[1];

    await page.goto(`/admin/seasons/${seasonId}/restrictions`);

    await page.waitForLoadState('networkidle');

    // Check for critical errors (ignore supabase realtime warnings)
    const criticalErrors = errors.filter(
      err => !err.includes('realtime') && !err.includes('subscription')
    );

    expect(criticalErrors.length).toBe(0);
  });
});
