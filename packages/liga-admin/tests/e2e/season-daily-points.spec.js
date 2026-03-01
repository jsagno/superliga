import { test, expect } from '@playwright/test';
import { loginAdmin } from './helpers.js';

async function getFirstSeasonId(page) {
  await page.goto('/admin/seasons', { waitUntil: 'networkidle' });

  const firstSeasonLink = page.locator('a[href*="/admin/seasons/"]').first();
  await expect(firstSeasonLink).toBeVisible({ timeout: 15000 });

  const href = await firstSeasonLink.getAttribute('href');
  const match = href?.match(/\/admin\/seasons\/([^\/]+)/);

  if (!match) {
    throw new Error('No se pudo resolver seasonId desde el listado de temporadas.');
  }

  return match[1];
}

test.describe('Season Daily Points (UI + Adjacent Regression)', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(
      !process.env.PLAYWRIGHT_ADMIN_EMAIL || !process.env.PLAYWRIGHT_ADMIN_PASSWORD,
      'Requires PLAYWRIGHT_ADMIN_EMAIL and PLAYWRIGHT_ADMIN_PASSWORD'
    );

    await loginAdmin(page, process.env.PLAYWRIGHT_ADMIN_EMAIL, process.env.PLAYWRIGHT_ADMIN_PASSWORD);
  });

  test('affected flow: daily points page renders filters and grid shell', async ({ page }) => {
    const seasonId = await getFirstSeasonId(page);

    await page.goto(`/admin/seasons/${seasonId}/daily-points`, {
      waitUntil: 'networkidle',
    });

    await expect(page.getByRole('heading', { name: /Resumen Diario de Puntos/i })).toBeVisible({ timeout: 10000 });

    await expect(page.getByPlaceholder(/Buscar jugador/i)).toBeVisible();
    await expect(page.getByRole('option', { name: /Todos los equipos/i })).toBeVisible();
    await expect(page.getByRole('option', { name: /Todas las zonas/i })).toBeVisible();

    const table = page.locator('table').first();
    const emptyState = page.getByText(/No hay datos para mostrar/i);

    const hasTable = await table.isVisible().catch(() => false);
    const hasEmpty = await emptyState.isVisible().catch(() => false);

    expect(hasTable || hasEmpty).toBe(true);
  });

  test('adjacent regression: season edit keeps days_per_round field visible and bounded', async ({ page }) => {
    const seasonId = await getFirstSeasonId(page);

    await page.goto(`/admin/seasons/${seasonId}/edit`, {
      waitUntil: 'networkidle',
    });

    const field = page.getByLabel(/Days per Round \(for tournament grouping\)/i);
    await expect(field).toBeVisible({ timeout: 10000 });

    await field.fill('20');
    await field.blur();

    const value = await field.inputValue();
    expect(Number(value)).toBeLessThanOrEqual(14);

    await field.fill('0');
    await field.blur();

    const minValue = await field.inputValue();
    expect(Number(minValue)).toBeGreaterThanOrEqual(1);
  });
});
