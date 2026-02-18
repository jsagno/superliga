import { test, expect } from '@playwright/test';
import { loginAdmin } from './helpers.js';

test('La lista de jugadores carga y muestra datos', async ({ page }) => {
  // Usa credenciales válidas de un admin existente
  await loginAdmin(page, process.env.PLAYWRIGHT_ADMIN_EMAIL, process.env.PLAYWRIGHT_ADMIN_PASSWORD);
  await page.goto('http://localhost:5174/admin/players');
  await expect(page.getByText(/Gestión de Jugadores/i)).toBeVisible();
  // Espera a que cargue al menos un jugador o el mensaje de vacío
  await expect(
    page.locator('.flex.flex-col.gap-4 > div, .text-slate-400')
  ).toBeVisible();
});
