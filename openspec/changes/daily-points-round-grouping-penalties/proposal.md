# Proposal: Daily Points Round Grouping with Progressive Penalties

## Why

The current daily points summary displays all dates as individual columns without logical grouping, making it difficult to track progress across tournament rounds. Additionally, the system currently reads battle data indirectly through battle links rather than using the authoritative `scheduled_match_result` source, and the penalty system for consecutive absences lacks graduated consequences before removal.

## What Changes

- **Add round-based grouping** to daily points grid with configurable round length (default: 4 days per round)
- **Display round headers** ("Ronda 1", "Ronda 2", etc.) above grouped day columns using colspan
- **Migrate data source** from `battle` → `scheduled_match_result.points_a` as the authoritative points source
- **Implement graduated penalty system** for consecutive missed matches:
  - 1st miss: -1 points
  - 2nd consecutive miss: -2 points
  - 3rd consecutive miss: -5 points
  - 4th consecutive miss: -10 points
  - After 4th miss: Remove player from grid entirely
- **Add `days_per_round` column** to `season` table (INT, default: 4)
- **Enhance player lifecycle handling** to properly respect `season_zone_team_player.start_date` and `end_date`
- **Visual updates** to grid headers, legend, and penalty display

## Capabilities

### New Capabilities

- `round-based-grouping`: Enable configurable round grouping in daily points grid with visual headers and round metadata tracking
- `graduated-penalty-system`: Track consecutive missed matches per player with escalating penalties and automatic removal logic

### Modified Capabilities

- `daily-points-summary`: Change data source from battle-based to scheduled_match_result-based, update grid rendering to include round headers, enhance player active date filtering

## Impact

**Database**:
- Migration to add `days_per_round` column to `season` table
- No changes to existing data; backward compatible with default value

**Backend Logic** (SeasonDailyPoints.jsx):
- Complete refactor of data loading to query `scheduled_match` → `scheduled_match_result`
- New consecutive miss tracking algorithm per player
- Player removal logic after 4th consecutive miss
- Round calculation and grouping logic

**UI Components**:
- New round header row with colspan rendering
- Updated table structure to support two-level headers (rounds + days)
- Modified cell rendering for penalty display
- Updated legend to reflect new penalty rules and removal behavior

**Business Rules**:
- Only penalize for dates within player's active range (`start_date` to `end_date`)
- Reset consecutive miss counter when player completes a match
- Players removed after 4th miss do not reappear even if they later complete matches

**Affected Files**:
- `packages/liga-admin/src/pages/admin/SeasonDailyPoints.jsx` - Major refactor
- `packages/liga-admin/src/pages/admin/SeasonEdit.jsx` - Add days_per_round field
- `supabase/migrations/` - New migration for season config
- `docs/openspec/business-rules/scoring-system.md` - Update penalty documentation
