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
  test('loads battle history with stats badges', async ({ page }) => {
    await setAuthenticatedHistoryScenario(page, 'default')
    await page.goto('/historial')

    await expect(page).toHaveURL(/\/historial/)
    await expect(page.getByRole('heading', { name: /Histórico/i })).toBeVisible()

    // Stats badges
    await expect(page.getByText('5')).toBeVisible()  // wins
      await expect(page.getByText('7', { exact: true })).toBeVisible()  // total
    await expect(page.getByText('71%')).toBeVisible() // win rate

    // Battle cards
    await expect(page.getByText(/Rival Uno/i)).toBeVisible()
    await expect(page.getByText(/Rival Dos/i)).toBeVisible()
    await expect(page.getByText(/Rival Tres/i)).toBeVisible()
  })

  test('shows empty state when there are no battles', async ({ page }) => {
    await setAuthenticatedHistoryScenario(page, 'empty')
    await page.goto('/historial')

    await expect(page.getByText(/Sin batallas registradas/i)).toBeVisible()
    await expect(page.getByText('0%')).toBeVisible() // win rate = 0
  })

  test('filters battles by type tab', async ({ page }) => {
    await setAuthenticatedHistoryScenario(page, 'default')
    await page.goto('/historial')

    // Default: all visible
    await expect(page.getByText(/Rival Uno/i)).toBeVisible()
    await expect(page.getByText(/Rival Dos/i)).toBeVisible()

    // Filter: Cup only
    await page.getByRole('button', { name: /Copa de Liga/i }).click()
    await expect(page.getByText(/Rival Dos/i)).toBeVisible()
    await expect(page.getByText(/Rival Uno/i)).toHaveCount(0)

    // Filter: Daily only
    await page.getByRole('button', { name: /Duelo de Guerra/i }).click()
    await expect(page.getByText(/Rival Uno/i)).toBeVisible()
    await expect(page.getByText(/Rival Dos/i)).toHaveCount(0)
  })

  test('back button navigates to dashboard', async ({ page }) => {
    await setAuthenticatedHistoryScenario(page, 'default')
    await page.goto('/historial')

    await page.getByRole('button', { name: /Volver al dashboard/i }).click()
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test('eye icon opens battle detail modal for first battle in list', async ({ page }) => {
    await setAuthenticatedHistoryScenario(page, 'default')
    await page.goto('/historial')

    // Find the first eye button and click it
    const eyeBtn = page.getByRole('button', { name: /Ver detalle de batalla/i }).first()
    await expect(eyeBtn).toBeVisible()
    await eyeBtn.click()

    // Modal should appear — in E2E there's no real battle data, but modal renders
    await expect(page.getByRole('dialog', { name: /Detalle de batalla/i })).toBeVisible()

    // Close modal with ✕
    await page.getByRole('button', { name: /Cerrar/i }).click()
    await expect(page.getByRole('dialog', { name: /Detalle de batalla/i })).not.toBeVisible()
  })
})
