import { expect, test } from '@playwright/test'

async function setAuthenticatedContext(page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('ligaJugador:e2eAuth', 'authenticated')
  })
}

test.describe('TablaEquipos', () => {
  test('loads the authenticated player zone by default and highlights the current team', async ({ page }) => {
    await setAuthenticatedContext(page)
    await page.goto('/tabla/equipos')

    await expect(page).toHaveURL(/\/tabla\/equipos/)
    await expect(page.getByRole('heading', { name: /Tabla de Equipos/i })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Zona 3' })).toBeVisible()
    await expect(page.locator('[data-team-id="team-berserk"]').first()).toBeVisible()
    await expect(page.locator('[data-current-team="true"]').first()).toContainText(/Berserk/i)
  })

  test('changes zone tabs and renders fewer than three teams without crashing', async ({ page }) => {
    await setAuthenticatedContext(page)
    await page.goto('/tabla/equipos')

    await page.getByRole('button', { name: 'Zona 2' }).click()
    await expect(page.locator('[data-team-id="team-oracles"]')).toBeVisible()
    await expect(page.locator('[data-team-id="team-titans"]')).toBeVisible()
    await expect(page.locator('[data-team-id="team-berserk"]')).toHaveCount(0)
  })
})