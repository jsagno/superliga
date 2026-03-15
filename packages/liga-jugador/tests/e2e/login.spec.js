// SPEC: docs/openspec/changes/liga-jugador/specs/login-jugador.md
// SPEC: docs/openspec/changes/liga-jugador/tasks.md — Task 2

import { test, expect } from '@playwright/test'

test.describe('Task 2 — Autenticación Google OAuth', () => {
  test.describe('LoginJugador — render estático', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/login')
    })

    // RF-LOGIN-01 — Botón Google visible y habilitado
    test('RF-LOGIN-01: muestra el botón "Continuar con Google" habilitado', async ({ page }) => {
      const btn = page.getByRole('button', { name: /continuar con google/i })
      await expect(btn).toBeVisible()
      await expect(btn).toBeEnabled()
    })

    // RF-LOGIN-01 — Título y subtítulo del header
    test('RF-LOGIN-01: muestra el título "Bienvenido a la Arena"', async ({ page }) => {
      await expect(page.getByRole('heading', { name: /bienvenido a la arena/i })).toBeVisible()
    })

    test('RF-LOGIN-01: muestra el subtítulo de la liga', async ({ page }) => {
      await expect(page.getByText(/liga interna de clash royale/i)).toBeVisible()
    })

    // RF-LOGIN-04 — Footer con versión
    test('RF-LOGIN-04: muestra la versión en el footer', async ({ page }) => {
      await expect(page.getByText(/powered by internal league system/i)).toBeVisible()
    })

    // Aviso de acceso restringido (componente de info)
    test('muestra el aviso de acceso restringido', async ({ page }) => {
      await expect(page.getByRole('heading', { name: /acceso restringido/i })).toBeVisible()
      await expect(
        page.getByText(/tu correo de google debe haber sido autorizado/i),
      ).toBeVisible()
    })
  })

  test.describe('RF-LOGIN-03 — Redirect desde login si ya hay sesión', () => {
    // Sin sesión activa, /login debe permanecer en /login (no redirigir a /dashboard)
    test('sin sesión: /login no redirige a /dashboard', async ({ page }) => {
      await page.goto('/login')
      await page.waitForTimeout(800)
      await expect(page).toHaveURL(/\/login/)
    })
  })

  test.describe('Task 2.4+2.5 — ProtectedRoute bloquea sin sesión', () => {
    // Escenario: acceder a ruta protegida sin sesión → redirect a /login
    test('/ redirige a /login si no hay sesión', async ({ page }) => {
      await page.goto('/')
      // The ProtectedRoute redirects unauthenticated users to /login
      await expect(page).toHaveURL(/\/login/, { timeout: 5000 })
    })

    test('/dashboard redirige a /login si no hay sesión', async ({ page }) => {
      await page.goto('/dashboard')
      await expect(page).toHaveURL(/\/login/, { timeout: 5000 })
    })

    test('/batallas redirige a /login si no hay sesión', async ({ page }) => {
      await page.goto('/batallas')
      await expect(page).toHaveURL(/\/login/, { timeout: 5000 })
    })

    test('/tabla redirige a /login si no hay sesión', async ({ page }) => {
      await page.goto('/tabla')
      await expect(page).toHaveURL(/\/login/, { timeout: 5000 })
    })
  })

  test.describe('Accesibilidad básica del formulario de login', () => {
    // The loading/disabled state on OAuth click is tested via code review:
    // LoginJugador.jsx → disabled={loading || status === 'resolving'}
    // E2E testing this state requires full Supabase-client mocking (out of scope).

    test('el botón Google NO está deshabilitado en la carga inicial', async ({ page }) => {
      await page.goto('/login')
      const btn = page.getByRole('button', { name: /continuar con google/i })
      await expect(btn).not.toBeDisabled()
    })

    test('no se muestra mensaje de "Acceso Restringido" en la primera carga (sin sesión previa)', async ({
      page,
    }) => {
      await page.goto('/login')
      // The "Acceso Restringido" block (red banner) only appears when
      // status === 'unauthorized' (after a failed sign-in attempt).
      // On a fresh load with no session the informational lock-notice
      // (heading) is visible, but the red error banner must not be.
      const redBanner = page.locator('.bg-red-950\\/40')
      await expect(redBanner).not.toBeVisible()
    })
  })
})
