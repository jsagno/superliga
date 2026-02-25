import { test, expect } from '@playwright/test';

// Test de ejemplo: verifica que la app carga y muestra el título
// Ajusta la URL si tu Vite server corre en otro puerto

test('La página principal carga y muestra el título', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/liga-admin|Liga Admin|React App/i);
});
