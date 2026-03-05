# Design: Daily Points Round Grouping and Penalties

## Context

The SeasonDailyPoints component currently displays a grid of players' daily match points across a season. The system loads scheduled matches with their linked battles and results, then aggregates points by date using a battle cutoff calculation (getBattleDateKey) to handle matches that span midnight.

**Current Architecture:**
- **Data Loading**: Single page component (SeasonDailyPoints.jsx) queries scheduled_match with nested joins to scheduled_match_battle_link, battle, and scheduled_match_result
- **Data Processing**: Processes battle_time from linked battles to determine game dates, aggregates points by player-date pairs
- **Rendering**: Uses useMemo for performance, renders a scrollable table with fixed player columns
- **State Management**: Local React state with useEffect for data loading, Supabase real-time subscriptions possible but not currently implemented

**Current Constraints:**
- Large datasets (hundreds of players × dozens of dates) require performance optimization
- Grid must remain responsive with horizontal scrolling for many date columns
- Battle cutoff logic (default 590 minutes) must be respected when grouping dates
- Player lifecycle dates (start_date/end_date) already tracked in season_zone_team_player

**Current Pain Points:**
- Grid displays dates sequentially without logical grouping (hard to track progress across tournament rounds)
- Current penalty logic partially implemented but inconsistent
- Data source uses indirection through battle links rather than authoritative scheduled_match_result
- No visual distinction between tournament rounds

**Stakeholders:**
- **Primary**: Liga admins reviewing tournament performance
- **Secondary**: Developers maintaining the system, future reporting features

## Goals / Non-Goals

**Goals:**
1. **Round-based grouping**: Enable configurable round lengths (default 4 days) with clear visual headers
2. **Clean data path**: Read points directly from scheduled_match_result.points_a instead of deriving from battles
3. **Graduated penalties**: Implement consistent consecutive miss tracking with escalating penalties (-1, -2, -5, -10)
4. **Player removal**: Automatically exclude players after 4 consecutive misses
5. **Lifecycle awareness**: Respect player start_date/end_date when determining active dates and calculating penalties
6. **Maintain performance**: Keep render performance acceptable with useMemo/useCallback optimizations
7. **Backward compatibility**: Ensure existing seasons render correctly with default round length of 4 days

**Non-Goals:**
- Real-time updates via Supabase subscriptions (defer to future enhancement)
- Historical round length changes within a season (days_per_round is season-level config, not date-based)
- Advanced penalty configuration (graduated schedule is fixed: -1, -2, -5, -10)
- Player reinstatement after removal (4th miss is permanent exclusion for the season)
- Multi-column sorting or advanced filtering beyond current player/team/zone filters

## Decisions

### Decision 1: Data Source Migration Strategy

**Choice**: Query scheduled_match joined with scheduled_match_result; treat absence of result as missed match.

**Rationale**:
- scheduled_match_result is the authoritative source for match points (already used in MatchReview)
- Eliminates indirection through battle_link system
- Simplifies miss detection: scheduled_match exists but no scheduled_match_result → miss
- Maintains compatibility with getBattleDateKey() for date grouping via scheduled_from timestamp

**Alternatives Considered**:
- **Keep battle-based approach**: Would maintain consistency with current code but perpetuates data indirection problem and doesn't address root cause
- **Hybrid approach (check both)**: Adds complexity without clear benefit since scheduled_match_result is already populated for all completed matches

**Implementation**:
```javascript
// Query scheduled_match with nested scheduled_match_result
const { data: matchesData } = await supabase
  .from("scheduled_match")
  .select(`
    scheduled_match_id,
    player_a_id,
    scheduled_from,
    result:scheduled_match_result!scheduled_match_id(
      points_a
    )
  `)
  .eq("season_id", seasonId)
  .eq("type", "CW_DAILY");

// Process matches: result exists → points, no result → miss
const dateKey = getBattleDateKey(match.scheduled_from, battleCutoffMinutes);
const points = match.result?.points_a ?? null; // null indicates miss
```

### Decision 2: Round Calculation Algorithm

**Choice**: Client-side calculation using modulo arithmetic on sequential date indices.

**Rationale**:
- Simple algorithm: `roundNumber = Math.floor(dateIndex / daysPerRound) + 1`
- No database changes needed beyond storing days_per_round
- Flexible for uneven final rounds (partial rounds handled automatically)
- Performance acceptable: calculations happen once in useMemo, not per cell

**Alternatives Considered**:
- **Database-stored round assignments**: Would require additional table/columns to store round_number per date, adds migration complexity and doesn't handle dynamic changes gracefully
- **Server-side calculation**: Adds backend route/function, unnecessary given lightweight computation and existing client-side date processing

**Implementation**:
```javascript
// After sorting dates array
const rounds = [];
let currentRound = { number: 1, dates: [], startIndex: 0 };

dates.forEach((date, idx) => {
  const roundNum = Math.floor(idx / season.days_per_round) + 1;
  if (roundNum !== currentRound.number) {
    rounds.push(currentRound);
    currentRound = { number: roundNum, dates: [], startIndex: idx };
  }
  currentRound.dates.push(date);
});
rounds.push(currentRound); // Push final round
```

### Decision 3: Consecutive Miss Tracking Logic

**Choice**: Revised algorithm that respects player lifecycle and only counts past dates where player was active.

**Key Rules**:
1. Only evaluate dates ≤ today (future dates don't count)
2. Only count dates within player's [start_date, end_date] range
3. Miss = (scheduled_match exists) AND (no scheduled_match_result) AND (date is past) AND (player active)
4. Counter resets to 0 when scheduled_match_result found
5. Once counter reaches 4, player excluded from entire grid display

**Rationale**:
- Current implementation counts all sequential dates, but should only count dates player was active
- Prevents unfair penalties for dates before player joined or after player left
- Aligns with business rules: only penalize players for matches they were expected to play

**Alternatives Considered**:
- **Database triggers for real-time tracking**: Complex, harder to debug, unnecessary since grid recalculates on load
- **Separate penalty tracking table**: Over-engineered for derived data that's cheap to calculate client-side
- **Different penalty schedule**: Business stakeholders prefer fixed graduated system

**Implementation**:
```javascript
// Process player's scheduled dates sequentially
const scheduledDates = getPlayerScheduledDates(playerId).sort();
let consecutiveMisses = 0;

scheduledDates.forEach(dateKey => {
  const isPast = new Date(dateKey) <= today;
  const isActive = isPlayerActiveOnDate(player, dateKey);
  
  if (!isPast || !isActive) {
    // Skip future dates and inactive dates (don't affect counter)
    return;
  }
  
  const hasResult = playerDatePoints[playerId]?.[dateKey]?.hasResult;
  
  if (hasResult) {
    consecutiveMisses = 0; // Reset counter
  } else {
    consecutiveMisses++;
    // Apply graduated penalty
    const penalty = getPenalty(consecutiveMisses); // -1, -2, -5, -10
    playerDatePoints[playerId][dateKey] = { points: penalty, isPenalty: true };
    
    if (consecutiveMisses >= 4) {
      excludedPlayers.add(playerId); // Mark for removal from grid
    }
  }
});
```

### Decision 4: Grid Rendering with Two-Level Headers

**Choice**: Use nested header rows with colspan for round headers, followed by individual date headers.

**Rationale**:
- Standard HTML table pattern (thead with multiple tr)
- Colspan naturally handles variable round lengths (including partial final round)
- Maintains fixed left columns (player/team) with horizontal scroll for dates
- Compatible with existing sticky positioning and responsive design

**Alternatives Considered**:
- **Grouped column approach with borders**: Visually weaker distinction, harder to scan
- **Separate tables per round**: Complex layout, breaks horizontal scrolling, poor UX

**Implementation**:
```jsx
<thead>
  {/* Round headers */}
  <tr>
    <th rowSpan={2}>Jersey</th>
    <th rowSpan={2}>Player</th>
    <th rowSpan={2}>Team</th>
    {rounds.map(round => (
      <th key={round.number} colSpan={round.dates.length} className="round-header">
        Ronda {round.number}
      </th>
    ))}
    <th rowSpan={2}>Total</th>
  </tr>
  {/* Date headers */}
  <tr>
    {dates.map(date => (
      <th key={date} className="date-header">
        {formatDate(date)}
      </th>
    ))}
  </tr>
</thead>
```

### Decision 5: Database Schema Changes

**Choice**: Add single column `days_per_round INT DEFAULT 4` to season table.

**Rationale**:
- Minimal schema change (one column, one migration)
- Default of 4 provides backward compatibility (existing seasons NULL → 4)
- Season-level config makes sense: round structure typically consistent across entire tournament
- No need for more complex date-based round definitions

**Alternatives Considered**:
- **Separate season_round_config table**: Over-engineered for single integer value
- **Store in JSON column**: Harder to query, validate, and maintain
- **No database change (hardcode 4)**: Inflexible, requires code changes for different round lengths

**Migration**:
```sql
-- Migration: 20260125000000_add_days_per_round.sql
ALTER TABLE season
ADD COLUMN days_per_round INT DEFAULT 4;

-- Add constraint: must be between 1 and 14 days
ALTER TABLE season
ADD CONSTRAINT days_per_round_range CHECK (days_per_round >= 1 AND days_per_round <= 14);

COMMENT ON COLUMN season.days_per_round IS 
  'Number of days per tournament round. Default: 4. Used for grid grouping in daily points view.';
```

### Decision 6: Performance Optimization Strategy

**Choice**: Maintain current useMemo approach with additional memoization for round calculations and penalty tracking.

**Rationale**:
- Current architecture with useMemo already handles large datasets acceptably
- Adding rounds and penalties increases computational complexity minimally (O(n) operations)
- Client-side calculation avoids additional backend complexity
- Browser rendering optimizations (virtualization) deferred until performance issues observed

**Key Optimizations**:
1. **useMemo for gridData**: Recompute only when matches, players, or filters change
2. **Penalty tracking in single pass**: Calculate all penalties during date iteration (no separate loop)
3. **Excluded player set**: Use Set for O(1) lookup when filtering grid rows
4. **Round metadata precomputed**: Calculate once, reuse for header rendering and data processing

**Alternatives Considered**:
- **React-window virtualization**: Adds complexity, only needed if >1000 players (current max ~200)
- **Server-side aggregation**: Requires new backend endpoint, increases latency, loses real-time filter responsiveness
- **Web Workers for computation**: Overkill for current dataset sizes, adds communication overhead

## Risks / Trade-offs

### Risk 1: Query Performance with Large Result Sets
**Description**: Joining scheduled_match with scheduled_match_result could return thousands of rows for active seasons.

**Mitigation**:
- Already filtered by season_id (indexed) and type='CW_DAILY'
- Supabase query returns nested structure (not Cartesian join)
- Similar query pattern used in other views (e.g., MatchReview) without issues
- If performance degrades: add zone_id filter to query (reduces results by ~factor of 4)

**Trade-off**: Accepting client-side processing cost for simpler architecture over backend API complexity.

### Risk 2: Grid Usability with Many Rounds
**Description**: Seasons with 40+ dates (10 rounds @ 4 days each) create very wide tables.

**Mitigation**:
- Horizontal scroll with fixed player columns (already implemented)
- Round headers provide visual anchors for navigation
- Filter by zone reduces visible data (typical use case)
- Monitor user feedback; consider round-based pagination if needed

**Trade-off**: Comprehensive view comes at cost of horizontal scrolling; prefer completeness over artificial pagination.

### Risk 3: Penalty Logic Complexity
**Description**: Consecutive miss tracking with lifecycle dates and reset logic has many edge cases (player joins mid-season, leaves early, gaps in schedule).

**Mitigation**:
- Extensive unit tests for penalty calculation function (see Task: Write tests for penalty logic)
- Clear documentation of rules in code comments
- Visual verification in UI (penalties color-coded red)
- Business rules documented in openspec/business-rules/scoring-system.md

**Known Edge Cases**:
- Player joins team mid-round: Penalties only apply to dates after start_date (expected behavior)
- Player leaves team: Penalties don't apply to dates after end_date (expected behavior)
- Schedule has multi-day gaps: Consecutive counter continues across gaps (expected behavior per business rules)

**Trade-off**: Accepting algorithm complexity for fair penalty system over simpler but less accurate approaches.

### Risk 4: Backward Compatibility
**Description**: Existing seasons don't have days_per_round value (NULL in database).

**Mitigation**:
- Database default: 4 (matches current implicit behavior)
- Client-side fallback: `season.days_per_round ?? 4`
- SeasonEdit form shows default value when editing old seasons
- Migration adds comment explaining default behavior

**Trade-off**: None—default strategy provides seamless compatibility.

### Risk 5: Player Removal Creates Data Loss Appearance
**Description**: Players excluded after 4 misses disappear from grid entirely, might look like bug or data error.

**Mitigation**:
- Updated legend explicitly states removal policy
- Console warning logged when players excluded (visible to admins with DevTools open)
- Consider future enhancement: "Show Removed Players" toggle (defer to future task)
- Document removal policy in business rules

**Trade-off**: Clean grid presentation vs. transparency about removed players. Prioritizing readability for active players.

## Migration Plan

### Pre-Deployment Steps
1. **Database Migration**:
   - Create and test migration locally: `20260125000000_add_days_per_round.sql`
   - Verify default value applies correctly to existing seasons
   - Confirm constraint validation works (1-14 range)

2. **Code Review**:
   - Architect reviews: data query changes, penalty logic, round calculations
   - Developer reviews: React component refactor, grid rendering
   - Run existing test suite (ensure no regressions in battleDateUtils, other views)

3. **Testing**:
   - Unit tests for penalty calculation function
   - Integration test: load season with 20+ dates, verify round grouping
   - Edge case test: partial final round, player lifecycle dates
   - Performance test: load season with all players (no filters)
   - Visual regression test: grid layout, colors, responsiveness

### Deployment Steps
1. **Apply Migration**: Run `days_per_round` migration on production database
2. **Deploy Frontend**: Update liga-admin with new SeasonDailyPoints implementation
3. **Verify**: Load existing season, confirm displays with default 4-day rounds
4. **Smoke Test**: Create test season with custom round length, verify grid updates

### Rollback Strategy
- **If critical bug found**:
  - Revert frontend deployment (previous version loads old data structure)
  - Database migration is additive (safe to leave column in place)
  - Hotfix if needed, redeploy when fixed
  
- **Database rollback** (only if necessary):
  ```sql
  ALTER TABLE season DROP COLUMN IF EXISTS days_per_round;
  ```

### Post-Deployment Verification
- [ ] Existing seasons display correctly with default 4-day rounds
- [ ] SeasonEdit form shows days_per_round field with default value 4
- [ ] New season with custom round length displays correct round headers
- [ ] Penalties display correctly (red cells with negative points)
- [ ] Players excluded after 4 misses no longer appear in grid
- [ ] Player lifecycle dates filter grid correctly
- [ ] Performance acceptable with full player roster loaded
- [ ] Grid responsive on mobile/tablet (horizontal scroll works)

## Open Questions

### Q1: Should removed players be recoverable?
**Status**: Deferred to future enhancement  
**Context**: Once a player hits 4 consecutive misses, they're excluded from grid. Should there be a way to "reinstate" them or view removed players?  
**Recommendation**: Ship without reinstatement feature; monitor user feedback. If needed, add "Show Removed Players" toggle in future sprint.

### Q2: Should round length be changeable mid-season?
**Status**: Out of scope (see Non-Goals)  
**Context**: Current design assumes days_per_round is constant for entire season.  
**Recommendation**: Keep simple season-level config. If complex round schedules needed, address in future design with proper date-based round table.

### Q3: Should we visualize penalty progression?
**Status**: Consider for current implementation  
**Context**: Cells show final penalty value (-1, -2, -5, -10) but don't indicate "this is miss #3".  
**Recommendation**: Add subtle indicator (e.g., small badge showing miss count) if space permits, otherwise defer to tooltip on hover.

### Q4: How to handle schedule gaps (no matches multiple days in a row)?
**Status**: Resolved  
**Decision**: Consecutive miss counter continues across gaps. Business rules state "consecutive scheduled dates," not "consecutive calendar days."

### Q5: Performance threshold for triggering backend aggregation?
**Status**: Monitor in production  
**Context**: At what dataset size should we move to backend aggregation API?  
**Recommendation**: Monitor performance with >500 players or >50 dates. If render time exceeds 2 seconds, create backend endpoint for aggregated data.
