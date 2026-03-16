// Integration tests — full end-to-end flows
// Sections 12.1, 12.2, 12.5, 12.6, 12.8 of the liga-jugador implementation plan

import { test, expect } from '@playwright/test'

// ─── Shared helpers ──────────────────────────────────────────────────────────

async function authenticatePlayer({ page }) {
  await page.addInitScript(() => {
    window.localStorage.setItem('ligaJugador:e2eAuth', 'authenticated')
    window.localStorage.setItem('ligaJugador:e2eDashboardScenario', 'default')
    window.localStorage.setItem('ligaJugador:e2eHistoryScenario', 'default')
    window.localStorage.setItem('ligaJugador:e2ePendingScenario', 'default')
    window.localStorage.setItem('ligaJugador:e2eLinkingScenario', 'default')
  })
}

// ─── 12.1: Full flow: login → dashboard → standings → pending battles → link ─

test.describe('12.1 – Flujo completo: portal player', () => {
  test.beforeEach(authenticatePlayer)

  test('dashboard carga con widgets activos', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/dashboard/)
    await expect(page.getByRole('heading', { name: /Bienvenido,/i })).toBeVisible()
  })

  test('navigación a tabla de posiciones y de vuelta', async ({ page }) => {
    await page.goto('/dashboard')
    await page.getByRole('link', { name: /tabla/i }).click()
    await expect(page).toHaveURL(/\/tabla/)
    await page.goBack()
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test('navegación a batallas pendientes desde BottomNav', async ({ page }) => {
    await page.goto('/dashboard')
    await page.getByRole('navigation').getByRole('link', { name: /batallas/i }).click()
    await expect(page).toHaveURL(/\/batallas/)
    await expect(page.getByRole('heading', { name: /batallas pendientes/i })).toBeVisible()
  })

  test('flujo vincular: abre panel al hacer click en Vincular', async ({ page }) => {
    await page.goto('/batallas')
    // Wait for pending battles to load
    const vincularBtn = page.getByRole('button', { name: /vincular/i }).first()
    await expect(vincularBtn).toBeVisible()
    await vincularBtn.click()
    // Panel should slide up
    await expect(page.getByText(/batalles disponibles para vincular/i).or(
      page.getByText(/vincular batalla/i)
    )).toBeVisible({ timeout: 5000 })
  })
})

// ─── 12.2: Full flow: login → historial → eye click → detail modal ────────

test.describe('12.2 – Flujo completo: historial y detalle de batalla', () => {
  test.beforeEach(authenticatePlayer)

  test('historial carga batallas y permite navegar a él desde nav', async ({ page }) => {
    await page.goto('/dashboard')
    // No direct nav link to historial in BottomNav — go directly
    await page.goto('/historial')
    await expect(page).toHaveURL(/\/historial/)
    await expect(page.getByRole('heading', { name: /histórico/i })).toBeVisible()
    // At least one battle card visible
    await expect(page.getByText(/Rival Uno/i)).toBeVisible()
  })

  test('click en ojo abre modal con aria-modal', async ({ page }) => {
    await page.goto('/historial')
    const eyeBtn = page.getByRole('button', { name: /ver detalle de batalla/i }).first()
    await expect(eyeBtn).toBeVisible()
    await eyeBtn.click()
    const dialog = page.getByRole('dialog', { name: /detalle de batalla/i })
    await expect(dialog).toBeVisible()
    // ESC closes modal
    await page.keyboard.press('Escape')
    await expect(dialog).not.toBeVisible()
  })

  test('botón cerrar del modal funciona', async ({ page }) => {
    await page.goto('/historial')
    await page.getByRole('button', { name: /ver detalle de batalla/i }).first().click()
    const dialog = page.getByRole('dialog', { name: /detalle de batalla/i })
    await expect(dialog).toBeVisible()
    await page.getByRole('button', { name: /cerrar/i }).click()
    await expect(dialog).not.toBeVisible()
  })
})

// ─── 12.3: Email no autorizado — login only shows restricted warning ─────────

test.describe('12.3 – Email no autorizado', () => {
  test('sin sesión activa, /dashboard redirige a /login', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 })
  })

  test('página de login muestra aviso de acceso restringido', async ({ page }) => {
    await page.goto('/login')
    // The login page shows a "restricted access" notice before auth
    await expect(
      page.getByText(/acceso restringido|solo correos autorizados/i)
    ).toBeVisible()
  })
})

// ─── 12.5: Responsividad mobile (375px, 390px, 414px) ────────────────────────

const MOBILE_VIEWPORTS = [
  { name: 'iPhone SE (375px)', width: 375, height: 667 },
  { name: 'iPhone 14 Pro (390px)', width: 390, height: 844 },
  { name: 'iPhone Plus (414px)', width: 414, height: 896 },
]

for (const vp of MOBILE_VIEWPORTS) {
  test(`12.5 – Dashboard responsive en ${vp.name}`, async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('ligaJugador:e2eAuth', 'authenticated')
      window.localStorage.setItem('ligaJugador:e2eDashboardScenario', 'default')
    })
    await page.setViewportSize({ width: vp.width, height: vp.height })
    await page.goto('/dashboard')
    await expect(page.getByRole('heading', { name: /Bienvenido,/i })).toBeVisible()
    // BottomNav is visible and within viewport
    const nav = page.getByRole('navigation')
    await expect(nav).toBeVisible()
    const navBox = await nav.boundingBox()
    expect(navBox).not.toBeNull()
    // Nav bottom edge should be within viewport
    expect(navBox.y + navBox.height).toBeLessThanOrEqual(vp.height + 5)
  })
}

// ─── 12.6: BottomNav no oculta contenido interactivo ─────────────────────────

test('12.6 – BottomNav no oculta el contenido principal en batallas', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('ligaJugador:e2eAuth', 'authenticated')
    window.localStorage.setItem('ligaJugador:e2ePendingScenario', 'default')
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/batallas')

  await expect(page.getByRole('heading', { name: /batallas pendientes/i })).toBeVisible()

  // The main content should have pb-24 (or similar) to not be hidden under nav
  // Verify that at least the first interactive button is clickable (not obscured)
  const firstBtn = page.getByRole('button').first()
  const btnBox = await firstBtn.boundingBox()
  const nav = page.getByRole('navigation')
  const navBox = await nav.boundingBox()

  if (btnBox && navBox) {
    // Ensure the button is rendered above the nav area on initial viewport.
    expect(btnBox.y).toBeLessThan(navBox.y)
  }
})

// ─── 12.8: Performance — dashboard first load < 3 seconds ───────────────────

test('12.8 – Dashboard first load completes within 3 seconds', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('ligaJugador:e2eAuth', 'authenticated')
    window.localStorage.setItem('ligaJugador:e2eDashboardScenario', 'default')
  })

  const start = Date.now()
  await page.goto('/dashboard')
  await expect(page.getByRole('heading', { name: /Bienvenido,/i })).toBeVisible()
  const elapsed = Date.now() - start

  // Should be well under 3s in test environment
  expect(elapsed).toBeLessThan(3000)
})
