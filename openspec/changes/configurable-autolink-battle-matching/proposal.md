# Proposal: Configurable Auto-Link Battle Matching

## Executive Summary

Make battle-to-date assignment configurable and implement intelligent battle disambiguation for the "auto vincular" feature in season administration.

---

## Problem Statement (As-Is)

### Current Implementation

The auto-link feature (`autoLinkBattles()` in SeasonsList.jsx) matches CW_DAILY scheduled matches with actual battles synced by the CRON service:

1. **Hardcoded Cutoff Time**: Date assignment uses `gameTime.setUTCMinutes(gameTime.getUTCMinutes() - 590)` meaning battles before 09:50 UTC count as the previous day (equivalent to 06:50 AM Argentina time, UTC-3).

2. **Duplicated Logic**: The same 590-minute offset appears in:
   - `SeasonsList.jsx` (lines 642, 21)
   - `SeasonDailyPoints.jsx` (lines 21)
   - Potentially other components using `getDateKey()`

3. **No Disambiguation**: When multiple battles occur on the same scheduled date (e.g., player battles at 09:45 UTC and 10:05 UTC), the system picks the first chronological match without quality assessment.

4. **Not Configurable**: Admins cannot adjust cutoff per season, requiring code changes for regional/timezone variations.

### Business Impact

- **Operational Rigidity**: Cannot adapt cutoff to league-specific rules without deploying code
- **Ambiguous Matches**: Battles near cutoff boundary may link to wrong scheduled date
- **Manual Intervention**: Admins must manually review and re-link incorrect auto-matches
- **Regional Variations**: Different timezones (Argentina UTC-3, other regions) need different cutoffs

---

## Proposed Solution (To-Be)

### Requirement (Rephrased & Formalized)

**As a** Liga admin reviewing CW_DAILY scheduled matches,  
**I want** the auto-link feature to intelligently match battles to scheduled dates using configurable cutoff rules,  
**So that** battles played near date boundaries are correctly assigned and ambiguous cases are resolved automatically.

### Functional Requirements

**FR1: Season-Level Battle Cutoff Configuration**
- Add `battle_cutoff_minutes` field to season table (default: 590 minutes = 09:50 UTC)
- Add `battle_cutoff_tz_offset` field for display (default: '-03:00' for Argentina)
- Season edit UI allows admins to configure both fields
- All date calculations use season-specific cutoff, not hardcoded value

**FR2: Centralized Date Calculation Utility**
- Create `lib/battleDateUtils.js` module with:
  - `getBattleDateKey(battleTimestamp, cutoffMinutes)` - Convert battle timestamp to game date using configurable cutoff
  - `isWithinScheduledWindow(battleTime, scheduledFrom, scheduledTo)` - Check if battle falls in scheduled range
  - `calculateTimeDelta(battleTime, scheduledMidpoint)` - Time proximity to scheduled midpoint
- Replace all hardcoded 590-minute logic with utility calls

**FR3: Battle Disambiguation Algorithm**
When 2+ battles match the same scheduled date/player:
- **Score battles** using weighted criteria:
  1. **Time Proximity** (40%): Closer to scheduled window midpoint scores higher
  2. **Battle Completeness** (30%): Higher round_count scores higher (best_of alignment)
  3. **Window Fit** (20%): Battles fully within window preferred over edge cases
  4. **Deck Validity** (10%): Battles with valid deck data score higher
- **Select highest-scoring battle** as the match
- **Log disambiguation details** for admin audit (console + future UI)

**FR4: Auto-Link Enhanced Logic**
- For each PENDING scheduled_match:
  1. Query battles using effective window: `[scheduled_from - cutoff_buffer, scheduled_to + cutoff_buffer]` where buffer = 30 minutes
  2. Apply `getBattleDateKey()` to normalize battle timestamps to game dates
  3. Filter battles matching the scheduled date
  4. If multiple candidates: run disambiguation algorithm
  5. Link highest-quality battle and update status to OVERRIDDEN
  6. Track disambiguation events (count, decision reasons)

**FR5: Backward Compatibility**
- Default cutoff (590 minutes) maintains current behavior
- Existing seasons without explicit config use defaults
- No retroactive re-linking (only affects future auto-link runs)

---

## Why This Change?

### Business Justification

1. **Operational Flexibility**: Admins can tune cutoff per season without developer intervention
2. **Reduced Manual Work**: Disambiguation algorithm handles edge cases automatically
3. **Audit Trail**: Logged decisions enable review of auto-match quality
4. **Scalability**: Centralized utility makes future timezone features easier
5. **Regional Adaptation**: Different leagues (Argentina, other countries) can use appropriate cutoffs

### Technical Benefits

1. **DRY Principle**: Single source of truth for date calculation (no duplicated 590-minute magic numbers)
2. **Testability**: Isolated utility functions enable unit testing of date logic
3. **Maintainability**: Config changes don't require code deployment
4. **Type Safety**: Utility functions provide clear contracts (input/output types)

---

## What Changes?

### Database Schema
- `season` table: add `battle_cutoff_minutes INT DEFAULT 590`, `battle_cutoff_tz_offset TEXT DEFAULT '-03:00'`

### Frontend Components
- `SeasonEdit.jsx`: Add cutoff configuration fields (number input + timezone dropdown)
- `SeasonsList.jsx`: Refactor `autoLinkBattles()` and `findAvailableBattle()` to use disambiguation
- `SeasonDailyPoints.jsx`: Replace hardcoded `getDateKey()` with utility import

### Utilities
- `lib/battleDateUtils.js`: New module with date calculation and disambiguation functions

### CRON
- No changes (battle sync logic stays the same)

---

## Impact Assessment

### Users Affected
- **Liga Admins**: Gain configuration control, see improved auto-link accuracy
- **Players**: Indirect benefit from correct battle-to-date assignment in standings

### Risk Analysis
- **Low Risk**: Changes are additive (new config fields, enhanced logic)
- **Mitigation**: Default values maintain current behavior; thorough E2E testing

### Performance Considerations
- **Disambiguation overhead**: Scoring 2-5 candidate battles adds <50ms per scheduled_match
- **Query optimization**: Use database indexes on battle_time, player_id (already exist)
- **Acceptable impact**: Auto-link runs asynchronously with progress UI

---

## Success Metrics

1. **Configuration Adoption**: 80%+ of new seasons use custom cutoff within 1 month
2. **Auto-Link Accuracy**: <5% manual re-link rate (down from current ~15%)
3. **Disambiguation Coverage**: 90%+ of multi-candidate cases automatically resolved
4. **Admin Satisfaction**: Positive feedback in post-deployment survey

---

## Alternatives Considered

### Option A: Client-Side Timezone Configuration
- **Rejected**: More complex, requires client-side date manipulation, harder to audit

### Option B: Keep Hardcoded Cutoff, Add Manual Disambiguation UI
- **Rejected**: Defeats automation purpose, still requires manual admin work

### Option C: Implement Full Multi-Timezone Support
- **Rejected**: Over-engineered for current need, can be future enhancement

---

## Open Questions

1. **Should we expose disambiguation scores in UI for admin review?**
   - **Decision**: Console logging for v1, UI dashboard in future iteration

2. **What happens if no battles match after applying cutoff?**
   - **Decision**: Skip linking (same as current behavior), count as "skipped" in progress

3. **Should we allow per-zone cutoff configuration?**
   - **Decision**: Season-level only for v1, zone-level can be added if needed

---

## Next Steps

1. **Review & Approval**: Product Manager + Architect validate proposal
2. **Design Phase**: Create detailed technical design (algorithms, data flows)
3. **Spec Phase**: Write functional requirements with BDD scenarios
4. **Task Breakdown**: Create implementation tasks with git standards
5. **Implementation**: Develop + test following OpenSpec workflow
6. **Deployment**: Migrate database, deploy frontend, monitor auto-link runs

---

**Status**: Awaiting Review  
**Created**: 2026-02-28  
**Author**: Architect Agent  
**Related Changes**: reconcile-season-duel-schedule, RES feature
