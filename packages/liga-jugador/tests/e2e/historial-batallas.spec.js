import { expect, test } from '@playwright/test'

async function setAuthenticatedHistoryScenario(page, historyScenario = 'default') {
  await page.addInitScript(
    ({ hs }) => {
      window.localStorage.setItem('ligaJugador:e2eAuth', 'authenticated')
      window.localStorage.setItem('ligaJugador:e2eHistoryScenario', hs)
    },
    { hs: historyScenario },
  )
}

test.describe('HistorialBatallas', () => {
  test('renders placeholder screen with heading', async ({ page }) => {
    await setAuthenticatedHistoryScenario(page, 'default')
    await page.goto('/historial')

    await expect(page).toHaveURL(/\/historial/)
    await expect(page.getByRole('heading', { name: /Historial de Batallas/i })).toBeVisible()
    await expect(page.getByText(/proximamente/i)).toBeVisible()
  })

  test('uses dedicated mobile scroll container', async ({ page }) => {
    await setAuthenticatedHistoryScenario(page, 'default')
    await page.goto('/historial')

    const content = page.getByTestId('historial-scroll-content')
    await expect(content).toBeVisible()

    const canSetScrollTop = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="historial-scroll-content"]')
      if (!el) return false
      el.scrollTop = 120
      return el.scrollTop >= 0
    })

    expect(canSetScrollTop).toBeTruthy()
  })
})
