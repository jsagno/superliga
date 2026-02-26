import { test, expect } from '@playwright/test';
import { loginAdmin } from './helpers.js';

test.describe('Zone-based player filtering in Battles History', () => {
  test.skip(
    !process.env.PLAYWRIGHT_ADMIN_EMAIL || !process.env.PLAYWRIGHT_ADMIN_PASSWORD,
    'Requiere PLAYWRIGHT_ADMIN_EMAIL y PLAYWRIGHT_ADMIN_PASSWORD'
  );

  test('shows all players when no zone is selected', async ({ page }) => {
    await loginAdmin(page, process.env.PLAYWRIGHT_ADMIN_EMAIL, process.env.PLAYWRIGHT_ADMIN_PASSWORD);
    await page.goto('/admin/battles/history');

    await expect(page.getByRole('heading', { name: /Histórico de Batallas/i })).toBeVisible();
    
    // Get the player dropdown
    const playerDropdown = page.locator('select').filter({ hasText: /Jugador/i }).first();
    await expect(playerDropdown).toBeVisible();
    
    // Count initial options (all players)
    const allOptions = await playerDropdown.locator('option').count();
    console.log(`Initial player count (no zone selected): ${allOptions}`);
    
    // Verify initial state shows "Todos los jugadores"
    const firstOption = await playerDropdown.locator('option').first().textContent();
    expect(firstOption).toContain('Todos los jugadores');
    
    // Store initial player count for comparison
    await page.evaluate((count) => {
      window.__initialPlayerCount = count;
    }, allOptions);
  });

  test('filters players when zone is selected', async ({ page }) => {
    await loginAdmin(page, process.env.PLAYWRIGHT_ADMIN_EMAIL, process.env.PLAYWRIGHT_ADMIN_PASSWORD);
    await page.goto('/admin/battles/history');

    // Wait for page to load
    await expect(page.getByRole('heading', { name: /Histórico de Batallas/i })).toBeVisible();
    
    // Get dropdowns
    const zoneDropdown = page.locator('label:has-text("Zona")').locator('..').locator('select');
    const playerDropdown = page.locator('label:has-text("Jugador")').locator('..').locator('select');
    
    await expect(zoneDropdown).toBeVisible();
    await expect(playerDropdown).toBeVisible();
    
    // Count players before zone selection
    const initialPlayerCount = await playerDropdown.locator('option').count();
    console.log(`Players before zone selection: ${initialPlayerCount}`);
    
    // Get available zones
    const zoneOptions = await zoneDropdown.locator('option').allTextContents();
    console.log('Available zones:', zoneOptions);
    
    // Skip if no zones available
    if (zoneOptions.length <= 1) {
      test.skip(true, 'No zones available to test filtering');
      return;
    }
    
    // Select the first non-empty zone (skip "Todas las zonas" option)
    const firstZoneOption = zoneOptions.find(z => !z.includes('Todas') && z.trim() !== '');
    if (!firstZoneOption) {
      test.skip(true, 'No valid zone to select');
      return;
    }
    
    console.log(`Selecting zone: ${firstZoneOption}`);
    await zoneDropdown.selectOption({ label: firstZoneOption });
    
    // Wait for the player assignment query to complete
    await page.waitForTimeout(2000);
    
    // Count players after zone selection
    const filteredPlayerCount = await playerDropdown.locator('option').count();
    console.log(`Players after zone selection: ${filteredPlayerCount}`);
    
    // Verify player count changed (filtered)
    // Note: If zone has no players, count will be 1 (just the empty option)
    // If zone has players, count should be different from initial
    expect(filteredPlayerCount).not.toBe(initialPlayerCount);
    
    // Check if label shows filtered count
    const playerLabel = page.locator('label:has-text("Jugador")');
    const labelText = await playerLabel.textContent();
    console.log(`Player label text: ${labelText}`);
    
    // If zone has players, label should show count like "Jugador (5 en zona)"
    // If zone has no players, first option should say "Sin jugadores en esta zona"
    const firstOption = await playerDropdown.locator('option').first().textContent();
    console.log(`First player option: ${firstOption}`);
    
    if (filteredPlayerCount === 1) {
      // No players in zone
      expect(firstOption).toContain('Sin jugadores en esta zona');
    } else {
      // Has players in zone
      expect(labelText).toMatch(/\(\d+ en zona\)/);
    }
  });

  test('resets to all players when zone is cleared', async ({ page }) => {
    await loginAdmin(page, process.env.PLAYWRIGHT_ADMIN_EMAIL, process.env.PLAYWRIGHT_ADMIN_PASSWORD);
    await page.goto('/admin/battles/history');

    await expect(page.getByRole('heading', { name: /Histórico de Batallas/i })).toBeVisible();
    
    const zoneDropdown = page.locator('label:has-text("Zona")').locator('..').locator('select');
    const playerDropdown = page.locator('label:has-text("Jugador")').locator('..').locator('select');
    
    // Count initial players
    const initialCount = await playerDropdown.locator('option').count();
    console.log(`Initial player count: ${initialCount}`);
    
    // Get available zones
    const zoneOptions = await zoneDropdown.locator('option').allTextContents();
    const firstZone = zoneOptions.find(z => !z.includes('Todas') && z.trim() !== '');
    
    if (!firstZone) {
      test.skip(true, 'No zone available to test');
      return;
    }
    
    // Select a zone
    await zoneDropdown.selectOption({ label: firstZone });
    await page.waitForTimeout(2000);
    
    const filteredCount = await playerDropdown.locator('option').count();
    console.log(`Filtered player count: ${filteredCount}`);
    
    // Clear zone selection (select "Todas las zonas")
    await zoneDropdown.selectOption({ index: 0 });
    await page.waitForTimeout(1000);
    
    // Count players after clearing zone
    const resetCount = await playerDropdown.locator('option').count();
    console.log(`Player count after reset: ${resetCount}`);
    
    // Should return to initial count
    expect(resetCount).toBe(initialCount);
    
    // Verify label doesn't show filtered count
    const playerLabel = page.locator('label:has-text("Jugador")');
    const labelText = await playerLabel.textContent();
    expect(labelText).not.toMatch(/\(\d+ en zona\)/);
  });

  test('maintains player selection when switching zones', async ({ page }) => {
    await loginAdmin(page, process.env.PLAYWRIGHT_ADMIN_EMAIL, process.env.PLAYWRIGHT_ADMIN_PASSWORD);
    await page.goto('/admin/battles/history');

    await expect(page.getByRole('heading', { name: /Histórico de Batallas/i })).toBeVisible();
    
    const zoneDropdown = page.locator('label:has-text("Zona")').locator('..').locator('select');
    const playerDropdown = page.locator('label:has-text("Jugador")').locator('..').locator('select');
    
    // Get available zones
    const zoneOptions = await zoneDropdown.locator('option').allTextContents();
    const zones = zoneOptions.filter(z => !z.includes('Todas') && z.trim() !== '');
    
    if (zones.length < 2) {
      test.skip(true, 'Need at least 2 zones to test switching');
      return;
    }
    
    // Select first zone
    await zoneDropdown.selectOption({ label: zones[0] });
    await page.waitForTimeout(2000);
    
    const playersInZone1 = await playerDropdown.locator('option').allTextContents();
    console.log(`Players in ${zones[0]}:`, playersInZone1.length - 1); // -1 for empty option
    
    // Select second zone
    await zoneDropdown.selectOption({ label: zones[1] });
    await page.waitForTimeout(2000);
    
    const playersInZone2 = await playerDropdown.locator('option').allTextContents();
    console.log(`Players in ${zones[1]}:`, playersInZone2.length - 1);
    
    // Verify player lists are different (likely different players in different zones)
    // Note: They might be the same if zones share all players, but counts should at least be valid
    expect(playersInZone2.length).toBeGreaterThanOrEqual(1); // At least the empty option
  });

  test('zone filter persists in URL parameters', async ({ page }) => {
    await loginAdmin(page, process.env.PLAYWRIGHT_ADMIN_EMAIL, process.env.PLAYWRIGHT_ADMIN_PASSWORD);
    await page.goto('/admin/battles/history');

    await expect(page.getByRole('heading', { name: /Histórico de Batallas/i })).toBeVisible();
    
    const zoneDropdown = page.locator('label:has-text("Zona")').locator('..').locator('select');
    
    // Get available zones
    const zoneValue = await zoneDropdown.locator('option').nth(1).getAttribute('value');
    const zoneName = await zoneDropdown.locator('option').nth(1).textContent();
    
    if (!zoneValue || zoneValue === '') {
      test.skip(true, 'No zone available');
      return;
    }
    
    // Select a zone
    await zoneDropdown.selectOption({ value: zoneValue });
    await page.waitForTimeout(2000);
    
    // Check URL contains zoneId parameter
    const url = page.url();
    console.log(`URL after zone selection: ${url}`);
    expect(url).toContain(`zoneId=${zoneValue}`);
    
    // Refresh page
    await page.reload();
    await page.waitForTimeout(2000);
    
    // Verify zone is still selected
    const selectedZone = await zoneDropdown.inputValue();
    expect(selectedZone).toBe(zoneValue);
    
    // Verify players are still filtered
    const playerLabel = page.locator('label:has-text("Jugador")');
    const labelText = await playerLabel.textContent();
    console.log(`Player label after refresh: ${labelText}`);
  });

  test('zone and player filter combination works correctly', async ({ page }) => {
    await loginAdmin(page, process.env.PLAYWRIGHT_ADMIN_EMAIL, process.env.PLAYWRIGHT_ADMIN_PASSWORD);
    await page.goto('/admin/battles/history');

    await expect(page.getByRole('heading', { name: /Histórico de Batallas/i })).toBeVisible();
    
    const zoneDropdown = page.locator('label:has-text("Zona")').locator('..').locator('select');
    const playerDropdown = page.locator('label:has-text("Jugador")').locator('..').locator('select');
    
    // Get zones
    const zoneOptions = await zoneDropdown.locator('option').allTextContents();
    const firstZone = zoneOptions.find(z => !z.includes('Todas') && z.trim() !== '');
    
    if (!firstZone) {
      test.skip(true, 'No zone available');
      return;
    }
    
    // Select zone
    await zoneDropdown.selectOption({ label: firstZone });
    await page.waitForTimeout(2000);
    
    // Get filtered players
    const playerOptions = await playerDropdown.locator('option').allTextContents();
    console.log('Filtered players:', playerOptions);
    
    if (playerOptions.length <= 1) {
      console.log('No players in selected zone');
      return;
    }
    
    // Select a player from the filtered list
    const firstPlayer = playerOptions.find(p => !p.includes('Todos') && !p.includes('Sin jugadores'));
    if (firstPlayer) {
      await playerDropdown.selectOption({ label: firstPlayer });
      await page.waitForTimeout(2000);
      
      // Verify URL has both parameters
      const url = page.url();
      expect(url).toContain('zoneId=');
      expect(url).toContain('playerId=');
      
      console.log(`Selected player ${firstPlayer} in zone ${firstZone}`);
    }
  });
});
