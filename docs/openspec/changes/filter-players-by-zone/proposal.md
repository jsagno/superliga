## Why

In the Battles History page, when users select a Zone (Zona), the Teams dropdown correctly filters to show only teams in that zone. However, the Players dropdown still shows ALL players in the system, rather than only players assigned to that zone for the active season. This creates a confusing user experience where users must manually filter through hundreds of players to find those in the selected zone. The fix aligns the player filtering with the already-working zone-based team filtering.

## What Changes

- Player dropdown (`Jugador`) will now show only players assigned to the selected zone for the active season
- When no zone is selected, all players are shown (current behavior)
- When zone is selected, only players with active assignments in that zone are displayed
- Team dropdown behavior remains unchanged (already working correctly)
- Player dropdown will remain empty or show all players if zone filter is cleared

## Capabilities

### New Capabilities
- `zone-based-player-filtering`: Filter player dropdown based on selected zone, showing only active players in that zone for the current season

### Modified Capabilities
<!-- No existing capabilities are changing in behavior -->

## Impact

- **Affected Code**: `packages/liga-admin/src/pages/admin/BattlesHistory.jsx`
- **APIs**: Queries to `season_zone_team_player` table (already being used for team filtering)
- **Dependencies**: None - uses existing Supabase queries
- **Systems**: Improves UX in LIGA-ADMIN battles history feature
- **Breaking Changes**: None - purely additive filtering behavior
