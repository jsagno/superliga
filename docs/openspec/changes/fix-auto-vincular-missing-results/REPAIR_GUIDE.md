# Repair Script Usage Guide

## Overview

This guide explains how to use `fix-script.sql` to repair missing `scheduled_match_result` records caused by the auto-vincular stage/api_game_mode bug.

**Estimated impact:** ~32 matches from 2026-02-19 through 2026-03-01

---

## Prerequisites

1. **Database Access:** Supabase SQL Editor or PostgreSQL client with admin privileges
2. **Backup:** ✅ Already implicit - script uses transactions
3. **Read Phase 2 findings:** Understand root cause in `investigation-report.md`

---

## How the Script Works

### Step-by-Step Logic

1. **Find Missing Matches**
   - Identifies CW_DAILY PENDING matches without `scheduled_match_result`
   - Date range: 2026-02-19 to 2026-03-01

2. **Map Stage → API Game Mode**
   - Uses `season_competition_config` to resolve correct `api_game_mode`
   - Fixes the root cause of the original bug

3. **Find Available Battles**
   - Queries `battle_round_player` → `battle_round` → `battle`
   - Applies time window with ±30 minute buffer
   - Filters by correct `api_game_mode` (not stage)
   - Applies `battle_cutoff_minutes` to match game dates
   - **Excludes battles already linked to other matches** (constraint: `uq_battle_used_once`)
   - Selects earliest available battle in window

4. **Calculate Points**
   - Counts rounds won per side (TEAM vs OPPONENT)
   - Determines player's side from `battle_round_player`
   - Checks extreme/risky status from `season_extreme_participant`
   - Applies point rules:
     - Perfect win (2-0): 4 points (5 if extreme/risky)
     - Win with loss (2-1): 3 points (4 if extreme/risky)
     - Loss with win (1-2): 1 point
     - Complete loss (0-2): 0 points

5. **Insert Records (Idempotent)**
   - Creates `scheduled_match_battle_link` if not exists
   - Creates `scheduled_match_result` if not exists
   - Updates `scheduled_match.status` to 'OVERRIDDEN'
   - Uses `ON CONFLICT DO NOTHING` for safety

6. **Audit Logging**
   - Temporary table `repair_audit` tracks all changes
   - Displays summary and detailed repair log

---

## Running the Script

### Step 1: Review Script (Dry Run)

The script is set to **ROLLBACK** by default. First execution shows what would be done:

```sql
-- In Supabase SQL Editor or psql:
-- Copy entire contents of fix-script.sql
-- Paste and execute
```

**Expected output:**
```
REPAIR SCRIPT COMPLETED
=================================================================
Matches repaired this run: 32
Total matches with results: 370
View repair details: SELECT * FROM repair_audit ORDER BY match_date;
=================================================================
```

**Review:**
- Check `repair_audit` table output
- Verify coverage summary table shows ~100% for past dates
- Confirm affected players (Guille, etc.) have battles linked

### Step 2: Apply Changes (Live Run)

Once satisfied with dry run:

1. Open `fix-script.sql`
2. Find the final line: `ROLLBACK;  -- Remove this line...`
3. Replace with: `COMMIT;`
4. Re-run the script
5. Verify in daily points grid that Guille shows 1 point (not -1) for 2026-02-22

---

## Verification Queries

### Check Specific Player (Guille)

```sql
-- Verify Guille's 2026-02-22 match now has result
SELECT 
    sm.scheduled_match_id,
    DATE(sm.scheduled_from) as match_date,
    p.nick,
    smbl.battle_id,
    smr.final_score_a,
    smr.final_score_b,
    smr.points_a,
    sm.status
FROM scheduled_match sm
JOIN player p ON p.player_id = sm.player_a_id
LEFT JOIN scheduled_match_battle_link smbl ON smbl.scheduled_match_id = sm.scheduled_match_id
LEFT JOIN scheduled_match_result smr ON smr.scheduled_match_id = sm.scheduled_match_id
WHERE p.nick = 'Guille'
  AND DATE(sm.scheduled_from) = '2026-02-22'
  AND sm.type = 'CW_DAILY';
```

**Expected:** 1 row with `battle_id` populated and `points_a = 1`

### Check Overall Coverage

```sql
-- Coverage summary after repair
SELECT 
    DATE(sm.scheduled_from) as match_date,
    COUNT(*) as total_matches,
    COUNT(smr.scheduled_match_id) as matches_with_results,
    ROUND(100.0 * COUNT(smr.scheduled_match_id) / COUNT(*), 2) as percent_coverage
FROM scheduled_match sm
LEFT JOIN scheduled_match_result smr ON smr.scheduled_match_id = sm.scheduled_match_id
WHERE sm.type = 'CW_DAILY'
  AND sm.scheduled_from >= '2026-02-19'
  AND sm.scheduled_from < '2026-03-02'
GROUP BY DATE(sm.scheduled_from)
ORDER BY match_date;
```

**Expected:** All past dates (2/19-2/28) should show 100% or close to it

### Check Daily Points Grid

In liga-admin UI:
1. Navigate to **Admin → Seasons → Daily Points**
2. Find row for **Guille** 
3. Check column for **2/22**
4. **Expected:** Shows `1` (not `-1`)

---

## Safety Features

### Idempotency
- Script checks for existing records before inserting
- Uses `ON CONFLICT DO NOTHING` clauses
- Can be run multiple times safely

### Transaction Control
- Entire script runs in single transaction
- ROLLBACK by default for safety
- Must explicitly change to COMMIT

### Audit Trail
- `repair_audit` temp table logs every change
- Includes: player, date, battle, points, timestamp
- Persists until transaction completes

### Scope Limitation
- Only targets CW_DAILY matches
- Only affects 2026-02-19 to 2026-03-01 date range
- Only processes PENDING matches without results
- **Battle Uniqueness:** Each battle can only be linked to ONE scheduled match (constraint: `uq_battle_used_once`)
  - Script automatically skips battles already linked to other matches
  - Selects next available battle in time window for affected players

---

## Troubleshooting

### Issue: "duplicate key value violates unique constraint 'uq_battle_used_once'"

**Cause:**
Database constraint prevents the same battle from being linked to multiple scheduled matches. This occurs when:
1. A battle was already auto-linked to another player's match
2. The script is trying to reuse that battle for a different match

**Resolution:**
✅ **Script has been updated** to automatically filter out battles already linked to other matches. Re-run the script with the updated version.

If the issue persists, check which battle is conflicting:
```sql
-- Find which match already has this battle linked
SELECT 
    sm.scheduled_match_id,
    DATE(sm.scheduled_from) as match_date,
    p.nick as player_nick,
    smbl.battle_id
FROM scheduled_match_battle_link smbl
JOIN scheduled_match sm ON sm.scheduled_match_id = smbl.scheduled_match_id
JOIN player p ON p.player_id = sm.player_a_id
WHERE smbl.battle_id = 'bc2baf8f-6190-d277-94b9-7675ba3a480b';  -- Replace with conflicting battle_id
```

---

### Issue: "No matches repaired this run: 0"

**Possible causes:**
1. ✅ All matches already have results (success!)
2. ❌ No battles exist for affected players
3. ❌ `season_competition_config` not configured for this stage

**Resolution:**
```sql
-- Check if battles exist for a specific player
SELECT COUNT(*) 
FROM battle_round_player brp
JOIN player p ON p.player_id = brp.player_id
WHERE p.nick = 'Guille'
  AND EXISTS (
      SELECT 1 FROM battle_round br
      JOIN battle b ON b.battle_id = br.battle_id
      WHERE br.battle_round_id = brp.battle_round_id
        AND b.battle_time >= '2026-02-22 10:00:00'
        AND b.battle_time <= '2026-02-23 09:59:59'
  );
```

### Issue: "Points calculated don't match expected"

**Possible causes:**
- Round counting logic difference
- Extreme/risky status not detected
- Player on OPPONENT side instead of TEAM

**Resolution:**
Review battle detail manually and adjust point calculation logic in script if needed.

### Issue: "Script times out"

**Possible causes:**
- Too many battles to process
- Missing indexes on battle_round_player

**Resolution:**
Run in smaller date ranges by modifying date filter:
```sql
-- Change line 82-83 to process one week at a time:
AND sm.scheduled_from >= '2026-02-19'
AND sm.scheduled_from < '2026-02-26'  -- First week only
```

---

## Post-Repair Actions

After successful repair:

1. ✅ **Verify Guille's 2/22** shows 1 point in daily points grid
2. ✅ **Run coverage query** to confirm ~100% on past dates
3. ✅ **Update tasks.md** - Mark Task 3.1 and 3.2 as completed
4. ✅ **Proceed to Phase 4** - Fix auto-vincular code to prevent recurrence
5. 📝 **Document repair execution** in investigation-report.md

---

## References

- **Root cause analysis:** See `investigation-report.md` Discovery 4
- **Original bug:** `SeasonsList.jsx` line 534 - `.eq("api_game_mode", stage)`
- **Correct implementation:** `ScheduledMatches.jsx` lines 1107-1130
- **Point calculation rules:** `REGALAMENTO.md` Section 5.3
