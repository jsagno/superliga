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
  test('loads default league standings and highlights the authenticated player', async ({ page }) => {
    await setAuthenticatedStandingsScenario(page)
    await page.goto('/tabla')

    await expect(page).toHaveURL(/\/tabla/)
    await expect(page.getByRole('heading', { name: /Tablas de Posiciones/i })).toBeVisible()
    await expect(page.getByLabel(/Seleccionar temporada/i)).toHaveValue('season-1')
    await expect(page.getByLabel(/Seleccionar zona/i)).toHaveValue('zone-3')
    await expect(page.getByRole('button', { name: 'Liga A' })).toHaveAttribute('aria-pressed', 'true')

    const currentPlayerRow = page.locator('[data-current-player="true"]')
    await expect(currentPlayerRow).toContainText(/Rauldaggs/i)
    await expect(currentPlayerRow).toContainText(/tú/i)
  })

  test('zone dropdown filters league standings', async ({ page }) => {
    await setAuthenticatedStandingsScenario(page)
    await page.goto('/tabla')

    const list = page.getByTestId('standings-list')
    await expect(list).toBeVisible()

    await page.getByLabel(/Seleccionar zona/i).selectOption('zone-1')
    await expect(page.locator('[data-player-id="league-a-1"]')).toBeVisible()
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

  test('opens on Liga C when the authenticated player belongs to Liga C', async ({ page }) => {
    await setAuthenticatedStandingsScenario(page, 'liga-c-default')
    await page.goto('/tabla')

    await expect(page.getByRole('button', { name: 'Liga C' })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('[data-player-id="league-c-2"]')).toBeVisible()
    await expect(page.locator('[data-player-id="league-a-1"]')).toHaveCount(0)
    await expect(page.locator('[data-current-player="true"]')).toContainText(/Rauldaggs/i)
  })
})