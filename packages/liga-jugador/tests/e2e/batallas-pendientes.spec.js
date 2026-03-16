import { expect, test } from '@playwright/test'

async function setAuthenticatedPendingScenario(page, scenario = 'default', linkingScenario = 'default') {
  await page.addInitScript(
    ({ pendingScenario, linkingScenarioValue }) => {
      window.localStorage.setItem('ligaJugador:e2eAuth', 'authenticated')
      window.localStorage.setItem('ligaJugador:e2ePendingScenario', pendingScenario)
      window.localStorage.setItem('ligaJugador:e2eLinkingScenario', linkingScenarioValue)
    },
    { pendingScenario: scenario, linkingScenarioValue: linkingScenario },
  )
}

test.describe('BatallasPendientes', () => {
  test('loads pending matches and allows type filtering', async ({ page }) => {
    await setAuthenticatedPendingScenario(page, 'default')
    await page.goto('/batallas')

    await expect(page).toHaveURL(/\/batallas/)
    await expect(page.getByRole('heading', { name: /Batallas Pendientes/i })).toBeVisible()
    await expect(page.getByText(/Rival Uno/i)).toBeVisible()
    await expect(page.getByText(/Rival Dos/i)).toBeVisible()

    await page.getByRole('button', { name: /Copa de Liga/i }).click()
    await expect(page.getByText(/Rival Dos/i)).toBeVisible()
    await expect(page.getByText(/Rival Uno/i)).toHaveCount(0)

    await page.getByRole('button', { name: /Duelo Diario/i }).click()
    await expect(page.getByText(/Rival Uno/i)).toBeVisible()
  })

  test('shows empty state when there are no pending matches', async ({ page }) => {
    await setAuthenticatedPendingScenario(page, 'empty')
    await page.goto('/batallas')

    await expect(page.getByText(/No tienes batallas pendientes/i)).toBeVisible()
  })

  test('shows pending count badge on Batallas nav item', async ({ page }) => {
    await setAuthenticatedPendingScenario(page, 'default')
    await page.goto('/batallas')

    await expect(page.locator('nav').getByText('3')).toBeVisible()
  })

  test('opens linking panel, selects battles and removes pending match after linking', async ({ page }) => {
    await setAuthenticatedPendingScenario(page, 'default', 'default')
    await page.goto('/batallas')

    await page.getByRole('button', { name: /Vincular batalla con Rival Uno/i }).first().click()
    await expect(page.getByText(/Vinculando a: Rival Uno/i)).toBeVisible()

    await page.getByRole('checkbox', { name: /Seleccionar batalla/i }).first().check()
    await page.getByRole('button', { name: /Vincular Batallas/i }).click()

    await expect(page.getByRole('status')).toContainText(/Batalla vinculada correctamente/i)
    await expect(page.getByTestId('pending-rival-sm-101')).toHaveCount(0)
  })
})
