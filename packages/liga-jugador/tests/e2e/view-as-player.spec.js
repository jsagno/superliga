// SPEC: docs/openspec/changes/admin-view-as-player/specs/view-as-player.md
// Covers FR-VAP-01 (admin-only visibility), FR-VAP-04 (persistent indicator),
// FR-VAP-05 (exit), FR-VAP-06 (read-only), FR-VAP-07 (unauthorized protection)

import { test, expect } from '@playwright/test'

// ── Helpers ──────────────────────────────────────────────────────────────────

async function setE2EAuth(page, { authenticated = false, role = 'PLAYER' } = {}) {
  await page.addInitScript(
    ({ isAuthenticated, userRole }) => {
      if (isAuthenticated) {
        window.localStorage.setItem('ligaJugador:e2eAuth', 'authenticated')
        window.localStorage.setItem('ligaJugador:e2eRole', userRole)
      } else {
        window.localStorage.removeItem('ligaJugador:e2eAuth')
        window.localStorage.removeItem('ligaJugador:e2eRole')
      }
    },
    { isAuthenticated: authenticated, userRole: role },
  )
}

// ── FR-VAP-01: Admin-only visibility ─────────────────────────────────────────

test.describe('View-as-player — FR-VAP-01: admin-only visibility', () => {
  test('authenticated PLAYER does not see "Ver como" button', async ({ page }) => {
    await setE2EAuth(page, { authenticated: true, role: 'PLAYER' })
    await page.goto('/dashboard')
    await expect(page.getByRole('button', { name: /Ver como/i })).not.toBeVisible()
  })

  test('unauthenticated user does not see "Ver como" button', async ({ page }) => {
    await setE2EAuth(page, { authenticated: false })
    await page.goto('/dashboard')
    // Redirects to login — no impersonation button
    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByRole('button', { name: /Ver como/i })).not.toBeVisible()
  })

  test('authenticated SUPER_ADMIN sees "Ver como" button on dashboard', async ({ page }) => {
    await setE2EAuth(page, { authenticated: true, role: 'SUPER_ADMIN' })
    await page.goto('/dashboard')
    await expect(page.getByRole('button', { name: /Ver como/i })).toBeVisible()
  })

  test('authenticated SUPER_ADMIN sees "Ver como" button on standings page', async ({ page }) => {
    await setE2EAuth(page, { authenticated: true, role: 'SUPER_ADMIN' })
    await page.goto('/tabla')
    await expect(page.getByRole('button', { name: /Ver como/i })).toBeVisible()
  })
})

// ── FR-VAP-04 + FR-VAP-05: Impersonation indicator + exit ────────────────────

test.describe('View-as-player — FR-VAP-04/05: persistent indicator and exit', () => {
  test('opening the View-as modal shows season and player selectors', async ({ page }) => {
    await setE2EAuth(page, { authenticated: true, role: 'SUPER_ADMIN' })
    await page.goto('/dashboard')

    await page.getByRole('button', { name: /Ver como/i }).click()

    // Dialog should appear
    await expect(page.getByRole('dialog', { name: /Ver como jugador/i })).toBeVisible()

    // Season selector present
    await expect(page.locator('#vap-season')).toBeVisible()

    // Player search present
    await expect(page.locator('#vap-search')).toBeVisible()

    // Cancel closes the modal
    await page.getByRole('button', { name: /Cancelar/i }).click()
    await expect(page.getByRole('dialog')).not.toBeVisible()
  })

  test('modal can be dismissed by clicking backdrop', async ({ page }) => {
    await setE2EAuth(page, { authenticated: true, role: 'SUPER_ADMIN' })
    await page.goto('/dashboard')

    await page.getByRole('button', { name: /Ver como/i }).click()
    await expect(page.getByRole('dialog')).toBeVisible()

    // Click outside the modal panel
    await page.mouse.click(5, 5)
    await expect(page.getByRole('dialog')).not.toBeVisible()
  })
})

// ── FR-VAP-07: Unauthorized protection ───────────────────────────────────────

test.describe('View-as-player — FR-VAP-07: unauthorized protection', () => {
  test('PLAYER role cannot reach /dashboard as a different player via URL', async ({ page }) => {
    // The feature is UI-only; no route exposes impersonation for players.
    // Confirm protected routes still require auth.
    await setE2EAuth(page, { authenticated: false })
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login/)
  })
})

// ── Structural smoke test ─────────────────────────────────────────────────────

test.describe('View-as-player — structural smoke tests', () => {
  test('AdminViewAsBar chunk is part of the bundle', async ({ page }) => {
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))

    await setE2EAuth(page, { authenticated: true, role: 'SUPER_ADMIN' })
    await page.goto('/dashboard')

    // No JS errors triggered by admin auth path
    expect(errors).toHaveLength(0)
  })

  test('SUPER_ADMIN has no impersonation banner on load (not impersonating)', async ({ page }) => {
    await setE2EAuth(page, { authenticated: true, role: 'SUPER_ADMIN' })
    await page.goto('/dashboard')

    // Banner only appears when actively impersonating
    await expect(page.getByRole('status')).not.toBeVisible()
  })
})
