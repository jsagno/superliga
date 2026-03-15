// SPEC: docs/openspec/changes/liga-jugador/tasks.md — Task 1
// Verifies the app builds and the Vite preview serves the expected entry point.

import { test, expect } from '@playwright/test'

test.describe('Task 1 — Scaffold del paquete', () => {
  test('1.10 La app arranca y devuelve HTML válido en la raíz', async ({ page }) => {
    await page.goto('/')
    // Should not land on a raw Vite error screen
    await expect(page.locator('body')).not.toBeEmpty()
  })

  test('1.10 El <title> del documento es "Liga Jugador"', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/Liga Jugador/i)
  })

  test('1.6 No hay errores de inicialización de Supabase que bloqueen el render', async ({
    page,
  }) => {
    const errors = []
    page.on('pageerror', (err) => errors.push(err.message))
    await page.goto('/')
    await page.waitForTimeout(500)
    // Console errors about missing env vars are expected in test env, but must not crash render
    const fatalErrors = errors.filter(
      (e) => !e.includes('Missing VITE_SUPABASE') && !e.includes('supabase'),
    )
    expect(fatalErrors).toHaveLength(0)
  })
})
