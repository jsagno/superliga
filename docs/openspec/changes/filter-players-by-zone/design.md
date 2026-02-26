## Context

The BattlesHistory component currently implements zone-based filtering for teams but not for players. The team filtering works by querying `season_zone_team` and `team` tables to populate the Teams dropdown only with teams assigned to the selected zone.

**Current State:**
- Zone dropdown: Shows all zones for the active season
- Team dropdown: Filters by selected zone (working correctly)
- Player dropdown: Shows ALL players regardless of zone selection

**Architecture:**
- BattlesHistory component maintains state using URL searchParams for persistence
- Zone selection triggers a `useEffect` that loads teams for that zone
- Player data comes from `fetchPlayersIndex()` which loads all players globally
- The player dropdown is rendered statically from the `players` array

**Constraints:**
- Must not break existing functionality (zone/team filtering for battles)
- Must not add new database tables or change data model
- Should use existing database queries (season_zone_team_player)
- Must maintain URL parameter persistence for zone filter
- Should maintain current pagination and battle filtering behavior

**Stakeholders:**
- Users: Admin managers who manage teams and want to see relevant players
- System: BattlesHistory page and related battle filtering logic

## Goals / Non-Goals

**Goals:**
- Filter player dropdown to show only players in selected zone for active season
- Maintain all existing filtering behavior for battles
- Keep URL parameters and state management consistent
- Provide empty/all option when zone not selected
- Improve user experience by reducing number of players to choose from

**Non-Goals:**
- Change player data model or add new tables
- Modify battle fetching or filtering logic
- Implement async player loading (use existing data structure)
- Add player search/auto-complete (separate feature)
- Change team filtering behavior (already working)

## Decisions

### Decision 1: Player Filtering Approach
**Choice:** Create a `useMemo` hook that filters the `players` array based on selected `zoneId` by querying zone team player assignments

**Rationale:** 
- Reuses existing player data structure
- No additional API calls needed (data already in Supabase queries)
- Keeps computation client-side for performance
- Maintains consistency with team filtering pattern

**Alternatives Considered:**
- Fetch players only when zone is selected: Extra API call on every zone change, less consistent with teams
- Add player filtering to `fetchPlayersIndex()`: Changes fundamental data structure, harder to reset

### Decision 2: Data Fetching Strategy
**Choice:** Add a new `useEffect` hook that fetches zone team player assignments when zone changes, then filter players based on these assignments

**Rationale:**
- Mirrors existing pattern for team loading
- Clear separation of concerns (one effect per state change)
- Easy to debug and track data flow

**Alternatives Considered:**
- Fetch all assignments upfront: N/A - this is a lookup table, best fetched on demand
- Inline filtering without fetching: Cannot access assignment data without query

### Decision 3: State Management
**Choice:** Store zone player assignments in component state (`zoneTeamPlayers`), filter players using `useMemo` in render

**Rationale:**
- Minimal state changes
- Leverages React optimization patterns
- Compatible with existing URL parameter architecture

**Alternatives Considered:**
- Modify searchParams: Overly complex, parameters are for user-facing filters only
- Add derived state: Unnecessary complexity

### Decision 4: Empty State Handling
**Choice:** When zone is not selected, show all players; when zone is selected, show only players from that zone

**Rationale:**
- Matches team dropdown behavior (enabled only with zone)
- Allows users to select players without zone if desired
- Simplifies initial UI state

**Alternatives Considered:**
- Disable player dropdown when zone not selected: Too restrictive, user might want to search without zone
- Always show only zone-filtered players: Not feasible initially when zone is empty

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| Zone team player query might be slow with many assignments | Load only active assignments (start_date <= now, end_date >= now or null) |
| Players list becomes stale if assignments added/removed | Query on every zone change (new useEffect) |
| Player name collisions or duplicates | Use player_id as key (already done) |
| Users expect alphabetical sorting of players | Maintain sort order from `players` array (inherited behavior) |
| Zone with no players shows empty dropdown | Display message "No players in this zone" or similar |

## Migration Plan

**Phase 1: Code Changes (immediate)**
1. Add new state: `const [zoneTeamPlayers, setZoneTeamPlayers] = useState([])`
2. Create useEffect hook for zone player assignment fetching
3. Create useMemo hook for filtering players based on zoneTeamPlayers
4. Update player dropdown to use filtered players
5. Handle edge cases (no zone selected, zone with no players)

**Phase 2: Testing**
1. Manual test: Select zone → verify players list updates
2. Manual test: Clear zone → verify all players shown
3. Manual test: Battle filtering still works with zone+player combo
4. Test with different zones (varying player counts)

**Phase 3: Deployment**
1. Merge to main branch
2. Deploy to staging
3. Smoke test in staging environment
4. Deploy to production
5. Monitor for any performance issues

**Rollback Strategy:** 
- Revert code changes to previous player dropdown implementation
- No data migrations needed (read-only queries)
- No database changes
- User state will remain in URL, just won't filter players

## Open Questions

1. Should we show all players if API query fails, or empty list?
2. Should we add tooltips explaining zone-based filtering?
3. Do we need to handle inactive players (is_active = false) separately?
4. Should we cache zone assignments or refetch each time zone changes?
