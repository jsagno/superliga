# Specifications: Configurable Auto-Link Battle Matching

## Functional Requirements

### FR1: Season-Level Battle Cutoff Configuration

**Description**: Admins can configure the battle-to-date cutoff time per season, replacing the hardcoded 590-minute (09:50 UTC) offset.

**Acceptance Criteria:**
- Season table has `battle_cutoff_minutes` column (integer, default 590)
- Season table has `battle_cutoff_tz_offset` column (text, default '-03:00')
- Season edit UI displays cutoff configuration fields
- Cutoff validation: must be between 0 and 1440 minutes (24 hours)
- Saving season persists cutoff values to database
- Loading season populates UI with existing cutoff values
- Default values maintain current system behavior (09:50 UTC cutoff)

**Business Rules:**
- BR1.1: Cutoff represents minutes to subtract from battle timestamp
- BR1.2: Timezone offset is for display only (does not affect calculation)
- BR1.3: Changing cutoff affects future auto-link runs, not past links
- BR1.4: Seasons without explicit cutoff use system default (590 minutes)

---

### FR2: Centralized Date Calculation Utility

**Description**: All components use a single utility module for battle date calculations, eliminating hardcoded offsets.

**Acceptance Criteria:**
- `lib/battleDateUtils.js` module exports:
  - `getBattleDateKey(battleTimestamp, cutoffMinutes)` - Returns ISO date string
  - `scoreBattleQuality(battle, scheduledFrom, scheduledTo, cutoffMinutes, bestOf)` - Returns score object
  - `selectBestBattle(candidates, ...)` - Returns best battle with reason
- SeasonsList.jsx uses utility functions
- SeasonDailyPoints.jsx uses utility functions
- No hardcoded 590-minute offsets remain in codebase
- Utility functions have JSDoc documentation
- Unit tests cover edge cases (midnight, month boundaries, leap years)

**Business Rules:**
- BR2.1: Date calculation must use UTC time (no local timezone conversion)
- BR2.2: Battle exactly at cutoff time counts as same day
- BR2.3: Utility functions are pure (no side effects)

---

### FR3: Battle Disambiguation Algorithm

**Description**: When multiple battles match the same scheduled date/player, the system automatically selects the highest-quality match using weighted scoring.

**Acceptance Criteria:**
- Scoring algorithm uses 4 weighted factors:
  - Time Proximity to scheduled midpoint: 40%
  - Battle Completeness (round_count vs best_of): 30%
  - Window Fit (within scheduled_from/to): 20%
  - Deck Validity (has raw_payload.team): 10%
- Total score ranges from 0-100
- Disambiguation logs include:
  - All candidate battle IDs and scores
  - Winner selection reason (SINGLE_CANDIDATE, CLEAR_WINNER, HIGHEST_SCORE, CLOSE_CALL)
  - Score breakdown for winner
- Console logs are structured (JSON-friendly)
- Score threshold: battles below 30 total are rejected (too low quality)

**Business Rules:**
- BR3.1: If no battles score above threshold (30), skip linking (don't force match)
- BR3.2: Ties (<1 point difference) are broken by earliest battle_time
- BR3.3: Disambiguation only runs if 2+ candidates exist for same scheduled date
- BR3.4: Battles outside scheduled date (after cutoff adjustment) are excluded

---

### FR4: Enhanced Auto-Link Logic

**Description**: Auto-link function loads season configuration and applies disambiguation when multiple battles match.

**Acceptance Criteria:**
- Auto-link loads `battle_cutoff_minutes` from season table before processing
- Fallback to 590 if season config missing
- Battle search includes 30-minute buffer before/after scheduled window
- Battles filtered by game date (using cutoffMinutes) before disambiguation
- Progress UI shows:
  - Current/total matches processed
  - Player name
  - Linked count
  - Skipped count (no suitable battle found)
  - Disambiguation count (when 2+ candidates)
- Final alert displays all counters
- Disambiguation decisions logged to console (not shown in UI)

**Business Rules:**
- BR4.1: Buffer prevents missed battles at window edges
- BR4.2: Only PENDING scheduled_match records are processed
- BR4.3: Already-linked battles (in scheduled_match_battle_link) are excluded
- BR4.4: Failed links count as "skipped" (don't block remaining matches)
- BR4.5: Status updated to OVERRIDDEN after successful link + result save

---

### FR5: Backward Compatibility

**Description**: Existing seasons and workflows continue functioning without modification.

**Acceptance Criteria:**
- Migration adds columns with default values (no manual update required)
- Seasons created before feature deploy use 590-minute cutoff automatically
- Existing auto-link UI button works without changes
- Existing unit tests pass
- No breaking changes to database schema (columns are additive)
- No retroactive re-calculation of past links

**Business Rules:**
- BR5.1: Default cutoff (590 minutes) replicates pre-feature behavior exactly
- BR5.2: Admin can update old seasons with custom cutoff via edit UI
- BR5.3: CRON battle sync remains unchanged (only frontend affected)

---

## BDD Scenarios

### Scenario 1: Admin Configures Custom Cutoff

**Given** an admin is editing a season  
**And** the season has default cutoff (590 minutes)  
**When** the admin changes cutoff to 420 minutes (7 hours)  
**And** sets timezone offset to '-03:00'  
**And** saves the season  
**Then** the database stores battle_cutoff_minutes = 420  
**And** the database stores battle_cutoff_tz_offset = '-03:00'  
**And** reloading the page shows the custom values  
**And** future auto-link runs use 420-minute cutoff for this season

---

### Scenario 2: Battle Date Calculation with Default Cutoff

**Given** a season has default cutoff (590 minutes = 09:50 UTC)  
**When** a battle occurs at 2026-02-28T09:45:00Z (5 minutes before cutoff)  
**Then** `getBattleDateKey('2026-02-28T09:45:00Z', 590)` returns '2026-02-27'  
**And** the battle is assigned to February 27th scheduled_match records

**Given** the same cutoff  
**When** a battle occurs at 2026-02-28T10:05:00Z (15 minutes after cutoff)  
**Then** `getBattleDateKey('2026-02-28T10:05:00Z', 590)` returns '2026-02-28'  
**And** the battle is assigned to February 28th scheduled_match records

---

### Scenario 3: Battle Date Calculation with Custom Cutoff

**Given** a season has custom cutoff (300 minutes = 05:00 UTC)  
**When** a battle occurs at 2026-02-28T04:30:00Z (30 minutes before cutoff)  
**Then** `getBattleDateKey('2026-02-28T04:30:00Z', 300)` returns '2026-02-27'

**Given** the same cutoff  
**When** a battle occurs at 2026-02-28T05:15:00Z (15 minutes after cutoff)  
**Then** `getBattleDateKey('2026-02-28T05:15:00Z', 300)` returns '2026-02-28'

---

### Scenario 4: Single Battle Auto-Link (No Disambiguation)

**Given** a season with cutoff 590 minutes  
**And** a PENDING scheduled_match for Player A on 2026-02-28  
**And** Player A has exactly 1 battle on 2026-02-28 (after cutoff adjustment)  
**When** admin triggers auto-link  
**Then** the single battle is linked to the scheduled_match  
**And** scheduled_match status becomes OVERRIDDEN  
**And** console logs show reason: 'SINGLE_CANDIDATE'  
**And** progress UI shows "+1 linked"

---

### Scenario 5: Multiple Battles Auto-Link with Disambiguation

**Given** a season with cutoff 590 minutes  
**And** a PENDING scheduled_match for Player B on 2026-02-28 from 08:00 to 20:00  
**And** Player B has 2 battles on 2026-02-28:
  - Battle #1 at 09:45 UTC (before cutoff edge), round_count=1
  - Battle #2 at 14:00 UTC (midpoint), round_count=3
**When** admin triggers auto-link  
**Then** disambiguation algorithm scores both battles  
**And** Battle #2 scores higher (proximity + completeness)  
**And** Battle #2 is linked to scheduled_match  
**And** console logs show:
  - reason: 'CLEAR_WINNER' or 'HIGHEST_SCORE'
  - winner battle_id and score
  - alternative battle_id and score
**And** progress UI shows "+1 linked" (not visible to admin that 2 were candidates)

---

### Scenario 6: No Suitable Battle Found (Skip)

**Given** a season with cutoff 590 minutes  
**And** a PENDING scheduled_match for Player C on 2026-02-28  
**And** Player C has no battles on 2026-02-28 (after cutoff adjustment)  
**When** admin triggers auto-link  
**Then** no battle is linked  
**And** scheduled_match status remains PENDING  
**And** progress UI shows "+1 skipped"  
**And** final alert says "X linked, Y skipped"

---

### Scenario 7: Battles Outside Cutoff Window Excluded

**Given** a season with cutoff 590 minutes  
**And** a PENDING scheduled_match for Player D on 2026-02-28 from 08:00 to 20:00  
**And** Player D has 3 battles:
  - Battle #1 at 2026-02-27T09:30 UTC → date key '2026-02-26' (excluded, wrong date)
  - Battle #2 at 2026-02-28T10:00 UTC → date key '2026-02-28' (included)
  - Battle #3 at 2026-03-01T08:00 UTC → date key '2026-03-01' (excluded, wrong date)
**When** admin triggers auto-link  
**Then** only Battle #2 is considered (passes date filter)  
**And** Battle #2 is linked (single candidate)  
**And** Battles #1 and #3 are not logged as alternatives

---

### Scenario 8: Close-Call Disambiguation Logged

**Given** a season with cutoff 590 minutes  
**And** a PENDING scheduled_match for Player E on 2026-02-28 from 08:00 to 20:00  
**And** Player E has 2 very similar battles:
  - Battle #1 at 13:55 UTC, round_count=3, has deck data → score 97.5
  - Battle #2 at 14:05 UTC, round_count=3, has deck data → score 96.8
**When** admin triggers auto-link  
**Then** Battle #1 is selected (higher score by 0.7 points)  
**And** console logs show:
  - reason: 'CLOSE_CALL' (score difference < 5)
  - winner: Battle #1 (score 97.5)
  - alternative: Battle #2 (score 96.8)
**And** admin can review console logs to verify correct choice

---

### Scenario 9: Battle Below Quality Threshold Rejected

**Given** a season with cutoff 590 minutes  
**And** a PENDING scheduled_match for Player F on 2026-02-28 from 08:00 to 20:00  
**And** Player F has 1 battle:
  - Battle #1 at 2026-02-27T22:00 UTC (outside window, wrong date), round_count=0 → score 15
**When** admin triggers auto-link  
**And** disambiguation scoring runs  
**Then** Battle #1 scores below threshold (30)  
**And** no battle is linked  
**And** scheduled_match remains PENDING  
**And** progress UI shows "+1 skipped"  
**And** console logs warn "Battle score too low: 15 < 30"

---

### Scenario 10: SeasonDailyPoints Uses Season Cutoff

**Given** a season with custom cutoff 420 minutes  
**And** an admin views the SeasonDailyPoints page  
**When** the component loads  
**Then** it fetches battle_cutoff_minutes from season table  
**And** all calls to `getDateKey()` use 420 minutes instead of 590  
**And** battles are assigned to correct game dates per season config

---

### Scenario 11: Backward Compatibility for Old Seasons

**Given** a season created before feature deployment (no cutoff set)  
**When** an admin triggers auto-link for that season  
**Then** the system uses default cutoff (590 minutes)  
**And** battle date calculations match pre-feature behavior exactly  
**And** no errors occur  
**And** admin sees normal linked/skipped counts

---

### Scenario 12: Migration Applies Defaults

**Given** the database has 10 existing seasons  
**When** the migration `20260300000000_add_battle_cutoff_config.sql` runs  
**Then** all 10 seasons have battle_cutoff_minutes = 590  
**And** all 10 seasons have battle_cutoff_tz_offset = '-03:00'  
**And** no data loss occurs  
**And** queries selecting new columns return default values

---

## Non-Functional Requirements

### Performance
- **NFR1**: Disambiguation scoring completes in <10ms per scheduled_match
- **NFR2**: Auto-link processes 100 matches in <60 seconds
- **NFR3**: Database queries use existing indexes (no new index required)

### Usability
- **NFR4**: Season edit UI explains cutoff with example (e.g., "09:50 UTC = 06:50 Argentina")
- **NFR5**: Disambiguation logs are readable by non-technical admins (clear language)

### Maintainability
- **NFR6**: Utility functions have 95%+ unit test coverage
- **NFR7**: JSDoc comments explain all public function parameters and return values
- **NFR8**: Scoring weights are configurable constants (easy to tune)

### Reliability
- **NFR9**: Failed disambiguation does not crash auto-link (skips match, continues)
- **NFR10**: Migration is idempotent (can run multiple times safely)

---

## Edge Cases

### EC1: Midnight Battles
- Battle at 2026-02-28T00:00:00Z with 590-minute cutoff
- Expected: Assigned to 2026-02-27 (midnight < 09:50)

### EC2: Month Boundary
- Battle at 2026-02-01T09:45:00Z with 590-minute cutoff
- Expected: Assigned to 2026-01-31 (before cutoff, previous month)

### EC3: Leap Year February 29
- Battle at 2026-02-29T09:45:00Z (if leap year) with 590-minute cutoff
- Expected: Assigned to 2026-02-28

### EC4: Timezone Change (DST)
- Battle during UTC stays consistent
- Argentina DST changes do not affect UTC-based calculation
- Timezone offset field is display-only (no calculation impact)

### EC5: Zero Cutoff
- Season with battle_cutoff_minutes = 0
- Expected: Battle timestamp date = game date (no offset)

### EC6: Full Day Cutoff (1440 minutes)
- Season with battle_cutoff_minutes = 1440 (24 hours)
- Expected: All battles count as previous day

---

## Validation Rules

### V1: Cutoff Range
- Minimum: 0 minutes
- Maximum: 1440 minutes (24 hours)
- Validation message: "Cutoff must be between 0 and 1440 minutes (0-24 hours)"

### V2: Timezone Offset Format
- Must match pattern: `^[+-]\d{2}:\d{2}$`
- Examples: '-03:00', '+05:30', '+00:00'
- Validation message: "Timezone offset must be in format ±HH:MM (e.g., -03:00)"

### V3: Score Threshold
- Battles must score ≥30 to be considered
- Threshold is constant (not configurable in v1)
- Lower threshold in future versions requires testing

---

## Acceptance Criteria Summary

**Feature is complete when:**
1. ✅ Database migration applied with default values
2. ✅ Season edit UI shows cutoff fields with validation
3. ✅ `battleDateUtils.js` module created with unit tests
4. ✅ SeasonsList.jsx uses configurable cutoff for auto-link
5. ✅ SeasonDailyPoints.jsx uses configurable cutoff for date display
6. ✅ Disambiguation algorithm logs decisions to console
7. ✅ All 12 BDD scenarios pass in E2E tests
8. ✅ No hardcoded 590-minute offsets remain in codebase
9. ✅ Backward compatibility verified (old seasons work)
10. ✅ Performance benchmarks met (NFR1-NFR3)

---

**Status**: Ready for Implementation  
**Priority**: High  
**Complexity**: Medium  
**Dependencies**: None (independent feature)
