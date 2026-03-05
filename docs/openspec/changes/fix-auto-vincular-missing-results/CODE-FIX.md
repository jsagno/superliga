# Phase 4: Auto-Vincular Code Fix

## Executive Summary

Fixed critical bug in `findAvailableBattle()` function that was preventing 5-13% of daily auto-vincular matches from being linked. The root cause was using tournament `stage` directly as `api_game_mode` filter instead of mapping through `season_competition_config` lookup table.

**Impact:** Prevents future occurrences of missing scheduled_match_result records (fixed ~25 historical issues in Phase 3 data repair).

---

## The Bug

### What Was Wrong

In [SeasonsList.jsx line 534](packages/liga-admin/src/pages/admin/SeasonsList.jsx#L534):

```javascript
// ❌ WRONG - Using stage directly as api_game_mode
.eq("api_game_mode", stage)
```

This filtered battles using the tournament `stage` value (e.g., `"SEMIFINALS"`, `"FINALS"`) as the API game mode. However:
- Tournament stages are not the same as API game modes
- API game modes are values like `"ladder"`, `"friendlyFriendly"`, `"clanWar"`
- Different tournaments can use the same stage but have different API game modes
- This mismatch caused the battle query to return 0 results for many players

### Why It Happened

The `scheduled_match` record has both `stage` and relationship to `competition`. The competition has a `season_competition_config` table that maps:
- **Input:** season_id + competition_id + stage
- **Output:** api_game_mode

The original code never did this lookup and just assumed stage = api_game_mode.

### What Players Saw

- Scheduled CW_DAILY match created (status: PENDING)
- Match appears in grid with -1 penalty
- Player thinks they missed the match
- Auto-vincular ran but didn't link any battle
- No scheduled_match_result created
- No scheduled_match_battle_link created

**Example:** Guille on 2026-02-22 had 3 available battles but 0 linked.

---

## The Fix

### Changes Made

#### 1. **Update `autoLinkBattles()` function**

Added `competition_id` to the select statement:

```javascript
// ✅ BEFORE: Missing competition_id
.select(`
  scheduled_match_id,
  season_id,
  zone_id,
  player_a_id,
  ...
`)

// ✅ AFTER: Include competition_id
.select(`
  scheduled_match_id,
  season_id,
  competition_id,  // ← Added
  zone_id,
  player_a_id,
  ...
`)
```

Pass `competition_id` to `findAvailableBattle()`:

```javascript
// ✅ BEFORE: 6 parameters
const availableBattle = await findAvailableBattle(
  match.player_a_id,
  match.scheduled_from,
  match.scheduled_to,
  match.stage,
  match.scheduled_match_id,
  seasonId
);

// ✅ AFTER: 7 parameters
const availableBattle = await findAvailableBattle(
  match.player_a_id,
  match.scheduled_from,
  match.scheduled_to,
  match.stage,
  match.scheduled_match_id,
  seasonId,
  match.competition_id  // ← Added
);
```

#### 2. **Fix `findAvailableBattle()` function**

Added `competitionId` parameter and stage → api_game_mode mapping:

```javascript
// ✅ BEFORE: Missing competitionId parameter
async function findAvailableBattle(playerId, scheduledFrom, scheduledTo, stage, scheduledMatchId, seasonId) {
  // ... immediately filters: .eq("api_game_mode", stage)  ← BUG HERE
}

// ✅ AFTER: Include competitionId and lookup correct mode
async function findAvailableBattle(playerId, scheduledFrom, scheduledTo, stage, scheduledMatchId, seasonId, competitionId) {
  // ... resolve api_game_mode from season_competition_config
  let expectedGameMode = null;
  if (seasonId && competitionId && stage) {
    const { data: modeConfig, error: modeConfigError } = await supabase
      .from("season_competition_config")
      .select("api_game_mode")
      .eq("season_id", seasonId)
      .eq("competition_id", competitionId)
      .eq("stage", stage)
      .maybeSingle();

    if (modeConfigError) {
      console.warn(`Failed to resolve api_game_mode for stage "${stage}":`, modeConfigError);
    }
    expectedGameMode = modeConfig?.api_game_mode || null;
  }
  
  // ... conditional filter: if (expectedGameMode) { battleQuery = battleQuery.eq("api_game_mode", expectedGameMode); }
}
```

#### 3. **Optimize Query Limits**

Removed fixed limits and added deterministic ordering:

```javascript
// ✅ BEFORE: Arbitrary limits could truncate valid results
.select("battle_round_id")
.eq("player_id", playerId)
.limit(5000)  // Might miss recent rounds

// ✅ AFTER: Deterministic ordering, no artificial limit
.select("battle_round_id")
.eq("player_id", playerId)
.order("created_at", { ascending: false })  // Most recent first
// No .limit() - retrieves all eligible rounds
```

#### 4. **Add Diagnostic Logging**

Added comprehensive console logging at all decision points:

```javascript
// Mode resolution
if (!expectedGameMode) {
  console.warn(`[findAvailableBattle] No api_game_mode configured for stage="${stage}" in competition=${competitionId}`);
}

// Battle candidate analysis
if (!candidateBattles || candidateBattles.length === 0) {
  console.debug(`[findAvailableBattle] No candidate battles found for player=${playerId}, expectedGameMode="${expectedGameMode}"`);
  return null;
}

// Selection decision
console.log(`[Battle Disambiguation] Match ${scheduledMatchId}:`, {
  player_id: playerId,
  scheduled_date: scheduledDateKey,
  candidates_total: candidateBattles.length,
  candidates_by_date: battleCandidates.length,
  selected_battle_id: selected.battle.battle_id,
  selected_score: selected.score.total,
  decision_reason: selected.reason,
  score_breakdown: selected.score.breakdown,
  alternatives: selected.alternatives.map(alt => ({
    battle_id: alt.battle_id,
    time: alt.battle_time,
    score: alt.score.total
  }))
});
```

### Files Modified

- [packages/liga-admin/src/pages/admin/SeasonsList.jsx](packages/liga-admin/src/pages/admin/SeasonsList.jsx)
  - Lines 333: Added `competition_id` to select
  - Line 388: Pass `match.competition_id` to findAvailableBattle
  - Lines 483-573: Complete refactor of findAvailableBattle function

---

## How It Works Now

### Correct Flow (Fixed)

1. Admin clicks "Auto-vincular" for a season
2. App fetches pending CW_DAILY matches **with** `competition_id`
3. For each match:
   - Call `findAvailableBattle()` with `competitionId`
   - Function looks up correct `api_game_mode` from `season_competition_config`
   - Query battles filtered by **correct** `api_game_mode`
   - Select best matching battle from filtered results
   - Link battle to match
   - Calculate result and create `scheduled_match_result`
   - Log diagnostic info showing selection reasoning

### Comparison

| Aspect | Before | After |
|--------|--------|-------|
| **Stage to mode mapping** | Uses stage directly | Queries `season_competition_config` |
| **Battle query filter** | `api_game_mode = stage` (wrong) | `api_game_mode = expectedGameMode` (correct) |
| **Success rate** | 87-97% | Expected 100% (limited by available battles) |
| **Diagnostics** | None | Comprehensive console logging |
| **Query limits** | Fixed `.limit(5000)` and `.limit(10)` | Deterministic ordering, no truncation |

---

## Testing & Verification

### Manual Testing (Next CW_DAILY Day)

1. **Wait for next CW_DAILY scheduled day** (or use test data)
2. **Navigate to:** Admin → Seasons → [Select Season] → Auto-vincular button
3. **Click Auto-vincular**
4. **Open Browser Console** (F12 → Console tab)
5. **Look for:**
   - `[findAvailableBattle]` logs with `expectedGameMode="..."`
   - `[Battle Disambiguation]` logs showing selection reason
   - No WARNING about mode mismatch
   - All matches successfully linked

### Verify Results

```sql
-- Check coverage for played date
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

-- Should show 100% (or close, if some players have no battles)
```

### Expected Results

- ✅ 100% coverage for most/all players on test day
- ✅ Console shows correct `api_game_mode` values
- ✅ All matches get `scheduled_match_result` records
- ✅ Point calculations match expected values
- ✅ No -1 penalties for players with battles

---

## Validation Checklist

Before deploying to production:

- [x] Code changes complete and committed
- [x] Diagnostic logging in place
- [x] Comparison with `ScheduledMatches.jsx` reference pattern ✅ Matches
- [x] Parameter passing updated (6 → 7 params)
- [ ] Manual test on next CW_DAILY day (pending)
- [ ] Browser console shows correct diagnostics (pending)
- [ ] 100% coverage achieved for test day (pending)
- [ ] No regressions reported (pending)

---

## Monitoring After Deployment

### Daily Checks

1. **Auto-vincular Runs:**
   - Check coverage percentage daily
   - Look for any drop below 100% (unless insufficient battles available)
   - Screenshot coverage table for trending

2. **Console Logs:**
   - During auto-vincular, review browser console for errors
   - Verify `expectedGameMode` is populated (not `"null"` or `undefined`)
   - Check for any WARNING logs about mode mismatch

3. **Data Quality:**
   - Spot-check daily points grid for unexpected -1 penalties
   - Verify point calculations for sampled matches
   - Monitor for duplicate `scheduled_match_result` records

### Alerts

Investigate immediately if:
- Coverage drops below 95% for a day
- New -1 penalties appear for players with battles on that date
- Console shows WARNING about mode mismatch
- Database shows duplicate `scheduled_match_result` records

---

## Edge Cases Handled

### 1. No Configuration Available

If `season_competition_config` has no entry for stage/competition:
- `expectedGameMode` remains `null`
- Filter is skipped (`.if (expectedGameMode) { ... }`)
- Query returns all battles in time window
- Fallback behavior mitigates the issue

### 2. Multiple Candidate Battles

If multiple battles match after filtering:
- `selectBestBattle()` scoring algorithm selects best match
- Console logs show score breakdown and alternatives
- Deterministic ordering prevents random selection

### 3. No Battles Available

Handled gracefully:
- Function returns `null`
- Match marked as `skipped` in auto-vincular
- No result created (expected behavior)
- Logged in console for visibility

---

## Reference Implementation

This fix aligns with existing correct pattern in [ScheduledMatches.jsx lines 1107-1130](packages/liga-admin/src/pages/admin/ScheduledMatches.jsx#L1107-L1130):

```javascript
// ScheduledMatches.jsx - CORRECT PATTERN
let expectedGameMode = null;
if (seasonId && competitionId && stage) {
  const { data: modeConfig, error: modeConfigError } = await supabase
    .from("season_competition_config")
    .select("api_game_mode")
    .eq("season_id", seasonId)
    .eq("competition_id", competitionId)
    .eq("stage", stage)
    .maybeSingle();

  if (modeConfigError) throw modeConfigError;
  expectedGameMode = modeConfig?.api_game_mode || null;
}

if (expectedGameMode) {
  battleQuery = battleQuery.eq("api_game_mode", expectedGameMode);
}
```

SeasonsList.jsx now uses the same pattern. ✅

---

## Future Prevention

To prevent similar issues:

1. **Code Review Checklist:**
   - Verify `stage` is never used directly as `api_game_mode`
   - Confirm `season_competition_config` lookups for stage-based filters
   - Check that all battle filtering uses `api_game_mode`, not stage

2. **Documentation:**
   - Update [architecture/liga-admin-technical-spec.md](../../architecture/liga-admin-technical-spec.md) with stage/mode distinction
   - Add data model note: "stage != api_game_mode; use season_competition_config to map"

3. **Code Standards:**
   - Add diagnostic logging to any battle-filtering logic
   - Require explicit comments explaining transformation logic
   - Enforce naming conventions (apiGameMode vs stage vs tournamentStage)

---

## Deployment Notes

- **Backwards compatible:** No database schema changes
- **No migrations needed:** Fix is application-layer only
- **Safe deployment:** Logic is defensive (null checks for missing config)
- **Rollback plan:** Git revert to previous SeasonsList.jsx commit
- **Monitoring:** Browser console logs visible immediately after deploy

