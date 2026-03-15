import { expect, test } from '@playwright/test'

async function setAuthenticatedStandingsScenario(page, scenario = 'default') {
  await page.addInitScript(
    ({ standingsScenario }) => {
      window.localStorage.setItem('ligaJugador:e2eAuth', 'authenticated')
      window.localStorage.setItem('ligaJugador:e2eStandingsScenario', standingsScenario)
    },
    { standingsScenario: scenario },
  )
}

test.describe('TablaPosiciones', () => {
  test('loads default zone standings and highlights the authenticated player', async ({ page }) => {
    await setAuthenticatedStandingsScenario(page)
    await page.goto('/tabla')

    await expect(page).toHaveURL(/\/tabla/)
    await expect(page.getByRole('heading', { name: /Tablas de Posiciones/i })).toBeVisible()
    await expect(page.getByLabel(/Seleccionar temporada/i)).toHaveValue('season-1')

    const currentPlayerRow = page.locator('[data-current-player="true"]')
    await expect(currentPlayerRow).toContainText(/Rauldaggs/i)
    await expect(currentPlayerRow).toContainText(/Tu/i)
  })

  test('zone filters work and auto-scroll moves to the authenticated player', async ({ page }) => {
    await setAuthenticatedStandingsScenario(page)
    await page.goto('/tabla')

    const list = page.getByTestId('standings-list')
    await expect(list).toBeVisible()

    await expect(page.getByRole('button', { name: 'Zona 3' })).toBeVisible()

    await page.waitForFunction(() => {
      const listElement = document.querySelector('[data-testid="standings-list"]')
      return listElement && listElement.scrollTop > 0
    })

    await page.getByRole('button', { name: 'Todas' }).click()
    await expect(page.locator('[data-player-id="zone-1-player-1"]')).toBeVisible()

    await page.getByRole('button', { name: 'Zona 2' }).click()
    await expect(page.locator('[data-player-id="zone-2-player-1"]')).toBeVisible()
    await expect(page.locator('[data-current-player="true"]')).toHaveCount(0)
  })

  test('league tabs switch the ranking source correctly', async ({ page }) => {
    await setAuthenticatedStandingsScenario(page)
    await page.goto('/tabla')

    await page.getByRole('button', { name: 'Liga A' }).click()
    await expect(page.locator('[data-player-id="league-a-1"]')).toBeVisible()
    await expect(page.locator('[data-current-player="true"]')).toContainText(/Rauldaggs/i)

    await page.getByRole('button', { name: 'Liga B' }).click()
    await expect(page.locator('[data-player-id="league-b-1"]')).toBeVisible()
    await expect(page.locator('[data-current-player="true"]')).toHaveCount(0)
  })
})