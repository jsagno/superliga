# Configurable Auto-Link Battle Matching

## Change Overview

Enhance the "auto vincular" (auto-link battles) feature in admin/seasons to make date cutoff configuration flexible and implement intelligent battle disambiguation when multiple battles match the same scheduled date.

## Problem Statement

Current auto-link implementation has hardcoded assumptions:
- Battle-to-date cutoff is fixed at 09:50 UTC (590 minutes offset)
- Same offset used across all components (SeasonsList, SeasonDailyPoints, BattlesHistory)
- No handling for edge cases where 2+ battles occur near cutoff boundary
- No quality scoring or disambiguation when multiple battles match

This creates operational issues:
- Cannot adjust cutoff per season or region
- Battles played 10 minutes before/after cutoff may be assigned to wrong date
- Manual intervention required when ambiguous matches occur

## Artifacts

1. **[proposal.md](./proposal.md)** - Business justification and requirements
2. **[design.md](./design.md)** - Technical architecture and algorithms
3. **[specs/autolink-battle-matching.md](./specs/autolink-battle-matching.md)** - Functional requirements and scenarios
4. **[tasks.md](./tasks.md)** - Implementation breakdown with git standards

## Scope

**In Scope:**
- Add season-level configuration for battle cutoff time
- Centralize date calculation logic into reusable utility
- Implement battle disambiguation algorithm with quality scoring
- Update all components to use configurable cutoff
- Migration to add season config columns

**Out of Scope:**
- Changing CRON battle sync frequency
- Multi-timezone support (stays UTC-based)
- Retroactive re-calculation of existing links
- UI for bulk re-linking with new config

## Impact Assessment

**Database:**
- Add `battle_cutoff_minutes` column to `season` table (default: 590)
- Add `battle_cutoff_tz_offset` column for display purposes (default: '-03:00' for Argentina)

**Frontend:**
- Refactor `autoLinkBattles()` to use configurable cutoff
- Add season edit UI for cutoff configuration
- Update `getDateKey()` in SeasonDailyPoints to use season config
- Consolidate date logic into `lib/battleDateUtils.js`

**Business Logic:**
- When 2+ battles match: score by time proximity to cutoff, battle completeness, player deck validity
- Always prefer battles closer to center of scheduled window
- Break ties using round_count and battle quality metrics

**Testing:**
- Unit tests for disambiguation algorithm
- E2E tests for season config UI
- Integration tests for auto-link with multiple candidates

## Related Changes

- Builds on duel reconciliation feature (reconcile-season-duel-schedule)
- Complements RES validation logic in BattlesHistory
- Uses same pattern as duelReconciliation.js utility module
