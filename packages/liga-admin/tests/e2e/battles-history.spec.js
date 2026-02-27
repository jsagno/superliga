import { test, expect } from '@playwright/test';
import { loginAdmin } from './helpers.js';

test('Histórico de batallas carga filtros y muestra estado de resultados', async ({ page }) => {
  test.skip(
    !process.env.PLAYWRIGHT_ADMIN_EMAIL || !process.env.PLAYWRIGHT_ADMIN_PASSWORD,
    'Requiere PLAYWRIGHT_ADMIN_EMAIL y PLAYWRIGHT_ADMIN_PASSWORD'
  );

  await loginAdmin(page, process.env.PLAYWRIGHT_ADMIN_EMAIL, process.env.PLAYWRIGHT_ADMIN_PASSWORD);
  await page.goto('/admin/battles/history', { waitUntil: 'networkidle' });

  await expect(page.getByRole('heading', { name: /Histórico de Batallas/i })).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('Jugador')).toBeVisible();
  await expect(page.getByText('Modo')).toBeVisible();

  const resultState = page
    .locator('text=No hay batallas para los filtros seleccionados., text=Ver detalle, text=Ocultar')
    .first();

  await expect(resultState).toBeVisible({ timeout: 20000 });
});
