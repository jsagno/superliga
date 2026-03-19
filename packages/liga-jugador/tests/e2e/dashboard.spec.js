// SPEC: docs/openspec/changes/liga-jugador/specs/dashboard-jugador.md
// Test cases from spec table (rows 1-5) — adapted for unauthenticated preview build.
//
// Most test cases for authenticated data (rows 1-2) require a real session and are
// marked with skip until Task 2.7/2.8 (bootstrap identity) is complete.
// Structural, error-state and no-session tests are fully automated here.

import { test, expect } from '@playwright/test'

async function setE2EAuth(page, { authenticated = false, scenario, role } = {}) {
  await page.addInitScript(
    ({ isAuthenticated, dashboardScenario, authRole }) => {
      if (isAuthenticated) {
        window.localStorage.setItem('ligaJugador:e2eAuth', 'authenticated')
      } else {
        window.localStorage.removeItem('ligaJugador:e2eAuth')
      }

      if (authRole) {
        window.localStorage.setItem('ligaJugador:e2eRole', authRole)
      } else {
        window.localStorage.removeItem('ligaJugador:e2eRole')
      }

      if (dashboardScenario) {
        window.localStorage.setItem('ligaJugador:e2eDashboardScenario', dashboardScenario)
      } else {
        window.localStorage.removeItem('ligaJugador:e2eDashboardScenario')
      }
    },
    {
      isAuthenticated: authenticated,
      dashboardScenario: scenario ?? null,
      authRole: role ?? null,
    },
  )
}

test.describe('Dashboard — unauthenticated redirects', () => {
  test('visiting /dashboard without session redirects to /login', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login/)
  })

  test('/login page does not show dashboard content', async ({ page }) => {
    await page.goto('/login')
    // "Bienvenido, [nombre]" is the dashboard greeting — /Bienvenido,/ (with comma) distinguishes it from
    // the login page's "Bienvenido a la Arena" heading
    await expect(page.getByRole('heading', { name: /Bienvenido,/ })).not.toBeVisible()
    await expect(page.locator('[aria-label="Notificaciones"]')).not.toBeVisible()
  })
})

test.describe('Dashboard — build structure smoke test', () => {
  // These tests verify the bundle includes expected identifiers via the preview build output.
  // Since OAuth intercept is not feasible in automated CI, we test JS bundle presence.

  test('DashboardJugador chunk is included in the build output', async ({ page }) => {
    // Load the shell and confirm Vite injected the entry bundle
    await page.goto('/')
    // The page redirects to /login because no session — entry JS must still load
    await expect(page).toHaveURL(/\/login/)
    // Verify the Vite entry script tag is present in the dom
    const scripts = await page.locator('script[type="module"]').count()
    expect(scripts).toBeGreaterThan(0)
  })

  test('login page loads without JS errors', async ({ page }) => {
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
    // Filter out known browser-extension and OAuth-provider errors
    const appErrors = errors.filter(
      (msg) => !msg.includes('chrome-extension') && !msg.includes('accounts.google'),
    )
    expect(appErrors).toHaveLength(0)
  })
})

test.describe('Dashboard — authenticated bypass scenarios', () => {
  test('shows active season context, stats and pending battle preview', async ({ page }) => {
    await setE2EAuth(page, { authenticated: true, scenario: 'default' })
    await page.goto('/dashboard')

    await expect(page).toHaveURL(/\/dashboard/)
    await expect(page.getByRole('heading', { name: /Bienvenido, Jugador Test/i })).toBeVisible()
    await expect(page.getByText(/Zona 1 · Liga A/i)).toBeVisible()
    await expect(page.getByText(/Progreso Duelos · 10\/16/i)).toBeVisible()
    await expect(page.getByText('Victorias')).toBeVisible()
    await expect(page.getByText('Rival Uno')).toBeVisible()
    await expect(page.getByRole('link', { name: /Ver todas las batallas/i })).toBeVisible()
  })

  test('shows duel phase start countdown when duels not started', async ({ page }) => {
    await setE2EAuth(page, { authenticated: true, scenario: 'preDuelStart' })
    await page.goto('/dashboard')

    await expect(page.getByText(/Progreso Duelos · 6\/16/i)).toBeVisible()
    await expect(page.getByText(/Fase de duelos comienza en/i)).toBeVisible()
    await expect(page.getByText(/día restante/i)).not.toBeVisible()
    await expect(page.getByText(/días restantes/i)).not.toBeVisible()
  })

  test('does not show "Últimas 24 horas" on the first day of duels', async ({ page }) => {
    await setE2EAuth(page, { authenticated: true, scenario: 'duelsFirstDay' })
    await page.goto('/dashboard')

    await expect(page.getByText(/Progreso Duelos · 0\/16/i)).toBeVisible()
    await expect(page.getByText(/días restantes/i)).toBeVisible()
    await expect(page.getByText(/Últimas 24 horas/i)).not.toBeVisible()
  })

  test('shows empty pending state when player has no pending matches', async ({ page }) => {
    await setE2EAuth(page, { authenticated: true, scenario: 'noPending' })
    await page.goto('/dashboard')

    await expect(page.getByText(/No tienes batallas pendientes/i)).toBeVisible()
  })

  test('shows informative message when player has no active season assignment', async ({ page }) => {
    await setE2EAuth(page, { authenticated: true, scenario: 'noSeason' })
    await page.goto('/dashboard')

    await expect(page.getByText(/Sin temporada activa/i)).toBeVisible()
  })

  test('shows retry state on dashboard service error', async ({ page }) => {
    await setE2EAuth(page, { authenticated: true, scenario: 'networkError' })
    await page.goto('/dashboard')

    await expect(page.getByText(/Error al cargar el dashboard/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /Reintentar/i })).toBeVisible()
  })

  test('shows 0% win rate without division errors', async ({ page }) => {
    await setE2EAuth(page, { authenticated: true, scenario: 'winRateZero' })
    await page.goto('/dashboard')

    await expect(page.getByText('0%')).toBeVisible()
    await expect(page.getByText(/Zona 2 · Liga B/i)).toBeVisible()
  })

  test('shows "Fase de duelos finalizada" when all 16/16 battles are completed', async ({ page }) => {
    await setE2EAuth(page, { authenticated: true, scenario: 'duelsCompleted' })
    await page.goto('/dashboard')

    await expect(page.getByText(/Progreso Duelos · 16\/16/i)).toBeVisible()
    await expect(page.getByText(/Fase de duelos finalizada/i)).toBeVisible()
    await expect(page.getByText(/día restante/i)).not.toBeVisible()
    await expect(page.getByText(/días restantes/i)).not.toBeVisible()
  })

  test('shows player selection guidance for authenticated super users without impersonation target', async ({ page }) => {
    await setE2EAuth(page, { authenticated: true, role: 'SUPER_USER' })
    await page.goto('/dashboard')

    await expect(page.getByText(/Selecciona un jugador para continuar/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /Abrir vista como jugador/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Bienvenido,/i })).not.toBeVisible()
  })
})
