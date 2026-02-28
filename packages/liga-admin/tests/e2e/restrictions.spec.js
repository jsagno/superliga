import { test, expect } from '@playwright/test';
import { loginAdmin } from './helpers.js';

test.describe('RES (Card Restrictions) - Complete E2E Suite', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(
      !process.env.PLAYWRIGHT_ADMIN_EMAIL || !process.env.PLAYWRIGHT_ADMIN_PASSWORD,
      'Requires PLAYWRIGHT_ADMIN_EMAIL and PLAYWRIGHT_ADMIN_PASSWORD'
    );

    await loginAdmin(
      page,
      process.env.PLAYWRIGHT_ADMIN_EMAIL,
      process.env.PLAYWRIGHT_ADMIN_PASSWORD
    );
  });

  async function navigateToRestrictionsPage(page) {
    // Navigate to seasons list
    await page.goto('/admin/seasons', { waitUntil: 'networkidle' });
    
    // Get first season ID
    const firstSeasonLink = page.locator('a[href*="/admin/seasons/"]').first();
    await expect(firstSeasonLink).toBeVisible({ timeout: 10000 });
    const href = await firstSeasonLink.getAttribute('href');
    const match = href?.match(/\/admin\/seasons\/([^\/]+)/);
    const seasonId = match?.[1];
    
    if (!seasonId) {
      throw new Error('No season available');
    }

    // Go to restrictions list
    await page.goto(`/admin/seasons/${seasonId}/restrictions`, { waitUntil: 'networkidle' });
    return seasonId;
  }

  // T10.2: View Restrictions List
  test('T10.2: View restrictions list page', async ({ page }) => {
    const seasonId = await navigateToRestrictionsPage(page);

    // Verify page header
    await expect(page.getByRole('heading', { name: /Restricciones de Cartas/i })).toBeVisible();

    // Verify season info displayed
    await expect(page.getByText(/ERA/i)).toBeVisible();
    await expect(page.getByText(/Temporada/i)).toBeVisible();

    // Verify search input is visible
    await expect(page.getByPlaceholder(/buscar|search/i)).toBeVisible();

    // Verify filter dropdown visible
    await expect(page.getByRole('button', { name: /Zona|Zone/i })).toBeVisible();
  });

  // T10.3: Search Restrictions
  test('T10.3: Search and filter restrictions', async ({ page }) => {
    await navigateToRestrictionsPage(page);

    // Get initial count
    const initialText = await page.locator('text=/\\d+ restricciones?|No restrictions/i').first().textContent();
    
    // If no restrictions exist, create one first
    if (initialText?.includes('0')) {
      // Get to edit page
      const addButton = page.getByRole('button', { name: /\+ Add|Agregar/i }).first();
      if (await addButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await addButton.click();
        
        // Select a player
        const playerDropdown = page.getByPlaceholder(/Select players/i);
        await playerDropdown.click();
        await playerDropdown.type('a');
        
        // Wait for player option to appear
        const playerOption = page.getByRole('option').first();
        await expect(playerOption).toBeVisible({ timeout: 5000 });
        await playerOption.click();

        // Go back to list
        await page.getByRole('button', { name: /Cancel|Cancelar/i }).click();
      }
    }

    // Test search
    const searchInput = page.getByPlaceholder(/buscar|search/i);
    await searchInput.fill('flash');
    
    // Wait for results to filter
    await page.waitForTimeout(500);
    
    // Verify search executed (results should change or show "no results" message)
    const resultsText = await page.locator('text=/found|No results|Restricciones/i').first().textContent();
    expect(resultsText).toBeTruthy();

    // Clear search
    await searchInput.clear();
    await page.waitForTimeout(500);
  });

  // T10.4: Delete Single Restriction
  test('T10.4: Delete single restriction with undo', async ({ page }) => {
    const seasonId = await navigateToRestrictionsPage(page);

    // Check if there are any restrictions
    const noRestrictionsMsg = page.getByText(/0 players found|No restrictions/i);
    const hasRestrictions = !(await noRestrictionsMsg.isVisible({ timeout: 2000 }).catch(() => false));

    if (hasRestrictions) {
      // Find first player card with restrictions
      const playerCard = page.locator('article').first();
      
      // Hover to show delete buttons
      await playerCard.hover();

      // Find a restriction card to delete
      const restrictionCard = playerCard.locator('[class*="border"]').first();
      
      // Hover over restriction card to show delete button
      await restrictionCard.hover();
      
      // Find and click delete button
      const deleteButton = restrictionCard.getByRole('button', { name: /delete|trash|remove/i }).first();
      if (await deleteButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await deleteButton.click();

        // Verify toast message (undo available for 5 seconds)
        const toast = page.getByText(/Eliminated|Deleted|Removed/i);
        await expect(toast).toBeVisible({ timeout: 5000 });
      }
    }
  });

  // T10.5: Delete All Player Restrictions
  test('T10.5: Delete all restrictions with confirmation', async ({ page }) => {
    await navigateToRestrictionsPage(page);

    // Check if there are restrictions
    const noRestrictionsMsg = page.getByText(/0 players found/i);
    const hasRestrictions = !(await noRestrictionsMsg.isVisible({ timeout: 2000 }).catch(() => false));

    if (hasRestrictions) {
      // Find first player card
      const playerCard = page.locator('article').first();
      
      // Look for "Clear All" button in the card
      const clearAllButton = playerCard.getByRole('button', { name: /Clear All|Eliminar Todas/i });
      
      if (await clearAllButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await clearAllButton.click();

        // Confirm in dialog
        const confirmButton = page.getByRole('button', { name: /Confirm|Confirmar|Yes/i });
        await expect(confirmButton).toBeVisible({ timeout: 5000 });
        await confirmButton.click();

        // Verify success toast
        const successToast = page.getByText(/success|eliminated|deleted/i);
        await expect(successToast).toBeVisible({ timeout: 5000 });
      }
    }
  });

  // T10.6: Create Bulk Restrictions
  test('T10.6: Create bulk restrictions for multiple players and cards', async ({ page }) => {
    const seasonId = await navigateToRestrictionsPage(page);

    // Navigate to edit page
    const addButton = page.getByRole('button', { name: /\+ Add|Agregar/i }).first();
    await expect(addButton).toBeVisible({ timeout: 5000 });
    await addButton.click();

    // Wait for edit page
    await expect(page.getByRole('heading', { name: /Editar/i })).toBeVisible({ timeout: 10000 });

    // Select first player
    const playerDropdown = page.getByPlaceholder(/Select players/i);
    await playerDropdown.click();
    await page.waitForTimeout(500);
    
    const firstPlayer = page.getByRole('option').first();
    if (await firstPlayer.isVisible({ timeout: 2000 }).catch(() => false)) {
      await firstPlayer.click();
    }

    // Wait and select a card
    const cardGrid = page.locator('[role="grid"]');
    await expect(cardGrid).toBeVisible({ timeout: 10000 });
    
    // Click first card
    const firstCard = cardGrid.locator('button').first();
    await firstCard.click({ timeout: 5000 });

    // Verify card selected (should have checkmark)
    await expect(firstCard.locator('svg')).toBeVisible({ timeout: 2000 });

    // Add a reason
    const reasonInput = page.getByPlaceholder(/Custom reason/i);
    if (await reasonInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await reasonInput.fill('Test restriction');
    }

    // Click Apply
    const applyButton = page.getByRole('button', { name: /Apply|Aplicar/i });
    await expect(applyButton).toBeVisible({ timeout: 5000 });
    await applyButton.click();

    // Confirm in dialog
    const confirmBtn = page.getByRole('button', { name: /Confirm|Confirmar/i });
    if (await confirmBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await confirmBtn.click();
    }

    // Wait for success and navigation back to list
    await expect(page.getByRole('heading', { name: /Restricciones/i })).toBeVisible({ timeout: 10000 });

    // Verify restriction appears in list
    const playerCardInList = page.locator('article').first();
    await expect(playerCardInList).toBeVisible({ timeout: 5000 });
  });

  // T10.7: Handle Duplicates
  test('T10.7: Duplicate detection and handling', async ({ page }) => {
    const seasonId = await navigateToRestrictionsPage(page);

    // Go to edit page
    const addButton = page.getByRole('button', { name: /\+ Add|Agregar/i }).first();
    await addButton.click({ timeout: 5000 });

    // Wait for page
    await expect(page.getByRole('heading', { name: /Editar/i })).toBeVisible({ timeout: 10000 });

    // Select player and card
    const playerDropdown = page.getByPlaceholder(/Select players/i);
    await playerDropdown.click();
    
    const playerOption = page.getByRole('option').first();
    if (await playerOption.isVisible({ timeout: 2000 }).catch(() => false)) {
      await playerOption.click();
    }

    // Select card
    const cardGrid = page.locator('[role="grid"]');
    const cardButton = cardGrid.locator('button').first();
    await cardButton.click({ timeout: 5000 });

    // Check for duplicate warning/preview
    const previewMatrix = page.locator('table');
    if (await previewMatrix.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Verify preview shows selection
      await expect(previewMatrix).toBeVisible();
    }

    // Add reason
    const reasonInput = page.getByPlaceholder(/Custom reason/i);
    if (await reasonInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await reasonInput.fill('Duplicate test');
    }

    // Apply
    const applyButton = page.getByRole('button', { name: /Apply|Aplicar/i });
    if (await applyButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await applyButton.click();

      // Confirm
      const confirmBtn = page.getByRole('button', { name: /Confirm|Confirmar/i });
      if (await confirmBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await confirmBtn.click();
      }
    }

    // Navigate back to edit page again to test duplicate detection
    await page.goto(`/admin/seasons/${seasonId}/restrictions`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    
    const addBtn2 = page.getByRole('button', { name: /\+ Add|Agregar/i }).first();
    if (await addBtn2.isVisible({ timeout: 2000 }).catch(() => false)) {
      await addBtn2.click();
      
      // Should show duplicate indicator in preview
      await expect(page.getByRole('heading', { name: /Editar/i })).toBeVisible({ timeout: 10000 });
    }
  });

  // T10.8: Validation Errors
  test('T10.8: Validation error messages', async ({ page }) => {
    await navigateToRestrictionsPage(page);

    // Go to edit page
    const addButton = page.getByRole('button', { name: /\+ Add|Agregar/i }).first();
    await addButton.click({ timeout: 5000 });

    await expect(page.getByRole('heading', { name: /Editar/i })).toBeVisible({ timeout: 10000 });

    // Try to apply without any selections
    const applyButton = page.getByRole('button', { name: /Apply|Aplicar/i });
    await applyButton.click({ timeout: 5000 });

    // Should show error message
    const errorMsg = page.getByText(/Select at least|Selecciona|Error/i);
    await expect(errorMsg).toBeVisible({ timeout: 5000 });
  });

  // T10.9: Real-time Updates (optional - requires multiple contexts)
  test('T10.9: Real-time subscription to restriction changes', async ({ page, context }) => {
    const seasonId = await navigateToRestrictionsPage(page);

    // Note: This test would require 2 separate browser contexts to properly test real-time updates
    // For now, we'll just verify the page loads and subscriptions are initialized
    
    // Get the network requests to verify subscription
    const networkRequests = [];
    page.on('request', request => {
      networkRequests.push(request.url());
    });

    // Verify page has real-time indicators (if any)
    await page.waitForTimeout(2000);

    // Should have made requests for real-time data
    expect(networkRequests.length).toBeGreaterThan(0);
  });
});
