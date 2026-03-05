# Investigation: Auto-Vincular Missing Results

**Status:** ✅ PHASE 4 COMPLETE - CODE FIX READY FOR TESTING  
**Created:** 2026-03-01  
**Last Updated:** 2026-03-02  
**Priority:** HIGH

## Problem Statement

The daily points grid shows -1 penalty for Guille on 2026-02-22, but battle data exists showing 1 point earned. Investigation revealed:

- ✅ `scheduled_match` record exists for 2026-02-22
- ❌ NO `scheduled_match_result` record exists (points_a is NULL)
- ❌ NO battle is linked via `scheduled_match_battle_link`

This suggests the "Auto-vincular" process in admin/seasons is not working correctly.

## Investigation Tasks

### Phase 1: Data Assessment ✅ IN PROGRESS

- [x] Identify Guille's 2/22 match has no result
- [ ] **Run comprehensive query** to find ALL matches with missing results
- [ ] Categorize by:
  - Has battle link but no result
  - No battle link and no result
  - Match date (past vs future)
- [ ] Count affected players and dates

**SQL Query to Run:**
```sql
-- Already copied to clipboard - run in Supabase SQL editor
SELECT sm.scheduled_match_id, sm.scheduled_from, DATE(sm.scheduled_from) as match_date,
       p.nick as player_nickname, link_status, result_status
FROM public.scheduled_match sm
...
```

### Phase 2: Root Cause Analysis 🟡 IN PROGRESS

- [x] **Review auto-vincular code** in `SeasonsList.jsx`
  - [x] Found `autoLinkBattles()` and `findAvailableBattle()`
  - [x] Traced battle linking + result creation flow
  - [x] Confirmed `scheduled_match_result` is created only after link+calculation succeeds
  - [ ] Point-calculation edge cases still pending deeper validation

- [x] **Check database triggers/functions**
  - [x] No trigger found that auto-creates `scheduled_match_result`
  - [x] No RLS policy evidence found blocking these inserts in current schema

- [x] **Review battle sync process** in `cron`
  - [x] CRON creates/updates `battle`, `battle_round`, `battle_round_player`
  - [x] CRON does NOT create `scheduled_match_result` or `scheduled_match_battle_link`

**Code Findings (2026-03-02):**
1. `SeasonsList.jsx` filters battles with `.eq("api_game_mode", stage)` inside `findAvailableBattle()`.
2. `ScheduledMatches.jsx` explicitly documents and implements that `stage` is tournament stage and must be mapped to `api_game_mode` via `season_competition_config`.
3. `findAvailableBattle()` limits player rounds to `.limit(5000)` and candidate battles to `.limit(10)`, both capable of producing selective false negatives.
4. The auto-link loop handles per-match failures with `continue`, which explains partial completion percentages instead of full failure.

### Phase 3: Data Repair ✅ COMPLETE

- [x] **Create repair SQL script** (`fix-script.sql`)
  - ✅ Maps stage → api_game_mode via season_competition_config (fixes root cause)
  - ✅ Applies battle_cutoff_minutes for accurate game date matching
  - ✅ Calculates points with extreme/risky bonuses
  - ✅ Idempotent with ON CONFLICT protection
  - ✅ Transaction-wrapped with ROLLBACK default (dry-run first)
  - ✅ Includes repair_audit temp table for tracking
  
- [x] **Created usage guide** (`REPAIR_GUIDE.md`)
  - ✅ Step-by-step execution instructions
  - ✅ Verification queries for Guille and overall coverage
  - ✅ Troubleshooting section
  - ✅ Safety features documentation
  
- [x] **Test repair script**
  - ✅ Tested in dry-run mode (ROLLBACK)
  - ✅ Verified ~25 matches identified for repair
  - ✅ Point calculations match expected
  - ✅ No duplicates or side effects detected
  
- [x] **Execute repair script on production**
  - ✅ Script executed with COMMIT
  - ✅ Guille 2/22 changed from -1 penalty to 1 point ✅
  - ✅ Coverage improved from 87-97% to 95-100%
  - ✅ Audit trail created for transparency

**Results:**
- 🎯 ~25 matches successfully repaired
- 📊 Coverage by date improved dramatically (most dates 95-100%)
- 🔍 7 edge cases identified (3 without battles, 4 with filtering issues)

### Phase 4: Code Fix ✅ COMPLETE

- [x] **Fix auto-vincular process** (`SeasonsList.jsx`)
  - ✅ **Root cause fix:** Map stage → api_game_mode via season_competition_config
    - Added `competitionId` parameter to findAvailableBattle()
    - Lookup correct api_game_mode for the stage/competition combo
    - Apply conditional filter with proper null handling
    - Reference verified against ScheduledMatches.jsx pattern
  
  - ✅ **Query optimizations:**
    - Removed `.limit(5000)` on battle_round_player query
    - Removed hardcoded `.limit(10)` on battle candidates
    - Added deterministic ordering for consistent results
  
  - ✅ **Diagnostic logging:**
    - Debug logs for mode resolution
    - Info logs for selection decisions
    - Warning logs for configuration issues
    - Comprehensive Battle Disambiguation output
    - Helps troubleshoot future issues
  
  - ✅ **Updated autoLinkBattles():**
    - Added `competition_id` to select statement
    - Pass competition_id to findAvailableBattle
  
- [x] **Documentation**
  - ✅ Created [CODE-FIX.md](CODE-FIX.md) with detailed explanation
    - What was wrong and why
    - Complete before/after comparison
    - Testing instructions
    - Monitoring guidelines
    - Reference implementation notes
  - ✅ Updated [tasks.md](tasks.md) with Phase 4 completion details
  
- [ ] **Integration tests** (Optional - manual test ready)
  - Test instructions documented in CODE-FIX.md
  - Can test on next CW_DAILY day
  - Browser console logs will provide verification

**File Changes:**
- [packages/liga-admin/src/pages/admin/SeasonsList.jsx](packages/liga-admin/src/pages/admin/SeasonsList.jsx)
  - Line 333: Added `competition_id` to select
  - Line 388: Pass `match.competition_id` to findAvailableBattle
  - Lines 483-573: Refactored findAvailableBattle with api_game_mode mapping
  - Add troubleshooting guide
  - Update deployment checklist

### Phase 5: Verification

- [ ] **Verify Guille's 2/22 shows 1 point** (not -1)
- [ ] **Verify all affected players corrected**
- [ ] **Run end-to-end test** of auto-vincular process
- [ ] **Monitor for new occurrences** over 1 week

## Next Steps

**Phase 2 Code Review Advanced ✅ (partial):**

Findings now show concrete implementation risks:
1. ✅ Wrong filter mapping: `stage` used directly as `api_game_mode` in auto-vincular
2. ✅ Query truncation: `.limit(5000)` on `battle_round_player`
3. ✅ Candidate truncation: `.limit(10)` on candidate battles
4. ✅ Partial-failure loop behavior matches observed 87-97% completion pattern

---

## Next Steps: Testing & Monitoring

### Phase 5: Verification (Ready to Start)

**Manual Testing:**
1. Wait for next CW_DAILY scheduled day or use test data
2. Navigate to: Admin → Seasons → [Select Season] → Auto-vincular button
3. Click Auto-vincular
4. Open Browser Console (F12)
5. Look for diagnostic logs:
   - `[findAvailableBattle]` logs with `expectedGameMode` values
   - No WARNING logs about mode mismatch
   - `[Battle Disambiguation]` logs showing selection reasoning
6. Verify results:
   - 100% coverage for that day (or missing players have no battles)
   - All matches get `scheduled_match_result` records
   - Point calculations correct

**Verification Queries:**
```sql
-- Check new date coverage
SELECT 
  DATE(sm.scheduled_from) as match_date,
  COUNT(*) as total_matches,
  COUNT(smr.scheduled_match_id) as matches_with_results,
  ROUND(100.0 * COUNT(smr.scheduled_match_id) / COUNT(*), 2) as percent_coverage
FROM scheduled_match sm
LEFT JOIN scheduled_match_result smr ON smr.scheduled_match_id = sm.scheduled_match_id
WHERE sm.type = 'CW_DAILY'
  AND DATE(sm.scheduled_from) = CURRENT_DATE
GROUP BY DATE(sm.scheduled_from);

-- Expected: 100% (or close if some players have no battles)
```

**Monitoring:**
- Check daily coverage percentage (should be 95-100%)
- Review browser console during auto-vincular runs
- Watch for any new -1 penalties appearing
- Alert immediately if coverage drops below 95%

## Findings

### Discovery 1: Guille 2/22 Match
- **scheduled_match_id:** `7ca662f0-71d5-4772-98df-0b51ca452af0`
- **scheduled_from:** 2026-02-22 10:00:00+00
- **scheduled_to:** 2026-02-23 09:59:59+00
- **player_a_id:** `e4e7df2a-3c9e-49a8-a6f2-ad5add0a3861`
- **Issue:** No scheduled_match_result, no battle linked
- **Expected:** 1 point based on user's report
- **Actual:** -1 penalty in daily points grid

### Discovery 3: Results Coverage Analysis (2026-03-01)

**Date-by-Date Coverage Summary:**

| Date | Total | With Results | Missing | Coverage |
|------|-------|--------------|---------|----------|
| 2/19 | 40 | 37 | 3 | 92.50% |
| 2/20 | 40 | 38 | 2 | 95.00% |
| 2/21 | 40 | 37 | 3 | 92.50% |
| 2/22 | 40 | 35 | 5 | 87.50% ← **Guille affected** |
| 2/23 | 40 | 37 | 3 | 92.50% ← **Guille affected** |
| 2/24 | 40 | 38 | 2 | 95.00% |
| 2/25 | 40 | 39 | 1 | 97.50% |
| 2/26 | 40 | 35 | 5 | 87.50% ← **Guille affected** |
| 2/27 | 40 | 39 | 1 | 97.50% |
| 2/28 | 40 | 33 | 7 | 82.50% ← **Worst day** |
| 3/01 | 40 | 19 | 21 | 47.50% ← Today (expected) |

**Total Missing (past dates only):** 32 matches without results across 10 days

**Critical Insight:**
Auto-vincular is NOT completely broken - it's working for **87-97%** of matches on most days. But it systematically misses **2-7 players per day** with no obvious pattern.

**This suggests:**
1. Auto-vincular runs but doesn't catch ALL players
2. Could be filtering issue (zone, team, status)
3. Could be partial batch failure
4. Could be specific player ID issue
5. Could be race condition in point calculation

**Affected Players Confirmed:**
- Guille (2/22, 2/23, 2/26)
- Totti
- Emeritus  
- aReN
- Moises
- And ~26 others across the 10-day period

### Discovery 4: Root Cause (Code + Schema Review, 2026-03-02)

**Primary root cause (application logic):**
- In `SeasonsList.jsx` (`findAvailableBattle`), auto-vincular filters battles with `.eq("api_game_mode", stage)`.
- `stage` is tournament stage metadata, not guaranteed to match battle `api_game_mode`.
- `ScheduledMatches.jsx` already documents this and resolves `stage -> api_game_mode` via `season_competition_config`.

**Secondary contributors (selective misses):**
- `.limit(5000)` when loading `battle_round_player` history can truncate valid recent rounds for high-volume players.
- `.limit(10)` candidate battle cap can hide valid same-day battles when many candidates exist.

**Why pattern matches observed behavior:**
- Loop uses per-match `continue` on failure, so process completes partially (87-97%) instead of failing globally.
- Missed players are those affected by mode mismatch and/or truncation edge cases.

**Database constraint discovered during repair (2026-03-02):**
- Unique constraint `uq_battle_used_once` on `scheduled_match_battle_link.battle_id`
- Each battle can only be linked to ONE scheduled match
- Repair script updated to exclude battles already linked to other matches
- This constraint explains why some players may have multiple battles but auto-vincular selected one already used

## Next Steps

1. ⏭️ **Phase 3:** Create idempotent repair SQL to backfill missing links/results for affected historical matches
2. ⏭️ **Phase 4:** Patch auto-vincular to map `stage -> api_game_mode`, and remove fragile candidate truncation
3. ⏭️ **Verification:** Re-run coverage query and verify impacted players (including Guille 2/22) show corrected points

## References

- Original issue: User reported "2/22 Guille shows -1 but we have a scheduled match with linked battle and also it has 1 point for Guille"
- Related OpenSpec change: `daily-points-round-grouping-penalties`
- Affected component: `SeasonsList.jsx` (Auto-vincular button)
- Affected tables: `scheduled_match`, `scheduled_match_result`, `scheduled_match_battle_link`
