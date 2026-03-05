# Cleanup & Reset Guide: Auto-Vincular Daily Duels

**Date:** 2026-03-03  
**Purpose:** Reset all auto-vincular data for CW_DAILY matches to start fresh diagnosis

---

## What This Does

This script will:

✅ **Delete all battle links** created by auto-vincular for CW_DAILY matches  
✅ **Delete all results** marked as 'ADMIN' (auto-vincular) for CW_DAILY matches  
✅ **Reset match status** from OVERRIDDEN back to PENDING  
✅ **Clear scores** (score_a, score_b) so matches show no points  
✅ **Provide audit trail** showing exactly what was deleted  

**Does NOT affect:**
- ❌ Manually-linked battles (linked_by_player or linked_by_admin via manual UI selection)
- ❌ Other match types (not CW_DAILY)
- ❌ Battle data itself (battles still exist in the database)

---

## How to Use

### Step 1: Review in Dry-Run Mode

1. **Open Supabase SQL Editor**
2. **Copy entire CLEANUP-RESET.sql script**
3. **Paste into SQL editor**
4. **Execute** (Script defaults to ROLLBACK - safe preview)
5. **Review output:**
   - Audit summary showing what would be deleted
   - Coverage table showing current state
   - Verify numbers look reasonable

### Step 2: Verify Deletion Count

Look for output like:
```
=================================================================
AUTO-VINCULAR CLEANUP COMPLETED
=================================================================
Battle links deleted: 25
Results deleted: 25
Matches reset to PENDING: 25
```

If these numbers are 0, something went wrong - check the coverage table.

### Step 3: Execute for Real

**Once verified, execute again:**

1. **Change the last line:**
   ```sql
   -- FROM:
   ROLLBACK;

   -- TO:
   COMMIT;
   ```

2. **Comment out ROLLBACK:**
   ```sql
   -- ROLLBACK;  -- DELETE THIS LINE and uncomment COMMIT above when ready to apply
   COMMIT;
   ```

3. **Execute the script**
4. **Confirm COMMIT completed** (no errors)

---

## Verification Queries

### Before Cleanup
```sql
-- Check current state of CW_DAILY matches
SELECT 
  DATE(sm.scheduled_from) as match_date,
  COUNT(*) as total_matches,
  COUNT(smr.scheduled_match_id) as matches_with_results,
  COUNT(CASE WHEN smr.decided_by = 'ADMIN' THEN 1 END) as auto_vincular_results,
  COUNT(CASE WHEN sm.status = 'PENDING' THEN 1 END) as pending_matches
FROM scheduled_match sm
LEFT JOIN scheduled_match_result smr ON smr.scheduled_match_id = sm.scheduled_match_id
WHERE sm.type = 'CW_DAILY'
GROUP BY DATE(sm.scheduled_from)
ORDER BY match_date DESC;
```

### After Cleanup
```sql
-- Should show all PENDING status and 0 results
SELECT 
  DATE(sm.scheduled_from) as match_date,
  COUNT(*) as total_matches,
  COUNT(smr.scheduled_match_id) as matches_with_results,
  COUNT(CASE WHEN sm.status = 'PENDING' THEN 1 END) as pending_matches
FROM scheduled_match sm
LEFT JOIN scheduled_match_result smr ON smr.scheduled_match_id = sm.scheduled_match_id
WHERE sm.type = 'CW_DAILY'
GROUP BY DATE(sm.scheduled_from)
ORDER BY match_date DESC;
```

Expected after cleanup: All pending_matches = total_matches, matches_with_results = 0

---

## Troubleshooting

### No rows deleted (all 0)

**Possible causes:**
1. No CW_DAILY matches in the database
2. All results marked as 'MANUAL' instead of 'ADMIN'
3. Query conditions aren't matching

**Check:**
```sql
-- Verify CW_DAILY exists
SELECT COUNT(*) FROM scheduled_match WHERE type = 'CW_DAILY';

-- Check what decided_by values exist
SELECT DISTINCT decided_by FROM scheduled_match_result;

-- Check statuses
SELECT DISTINCT status FROM scheduled_match WHERE type = 'CW_DAILY';
```

### Error: "Cannot delete due to foreign key"

This shouldn't happen because we're deleting in correct order:
1. Delete battle links first
2. Delete results second
3. Update matches last

If it occurs, verify no other constraints exist on these tables.

### Partial deletion (only some rows deleted)

This could happen if:
- Cleanup was already run once (idempotent - safe to run again)
- Some matches have different decided_by values

Check the audit output carefully.

---

## What Happens to Daily Points Grid

After cleanup:
- **Players will see: -1 penalty** (no result created)
- **Reason:** No battle linked, no result to calculate points
- **This is correct state** for testing auto-vincular fresh

When you run auto-vincular again:
- It should link battles and create results
- Points will recalculate
- Player should see actual points (not -1)

---

## Safety Features

✅ **Transaction-wrapped** - Can ROLLBACK if needed  
✅ **Audit trail** - Cleanup_audit table tracks all deletions  
✅ **Idempotent** - Safe to run multiple times  
✅ **Dry-run first** - Defaults to ROLLBACK  
✅ **Limited scope** - Only affects CW_DAILY + ADMIN results  

---

## After Cleanup

1. **UI Update:** Refresh browser cache (F5 or Ctrl+Shift+R)
2. **Verify Grid:** Daily points grid should show -1 for all players again
3. **Code Test:** If you made code changes, test auto-vincular now
4. **Monitor:** Watch battle_round_player API calls in Network tab

---

## Rollback

If something goes wrong and you want to restore from cleanup:

**Option 1 (if still in transaction):**
- Don't commit, just ROLLBACK within the same SQL session

**Option 2 (if already committed):**
- Unfortunately, no automatic backup made
- Would need manual intervention or database restore
- This is why we do dry-run first!

---

## Questions?

This script:
- Targets only auto-vincular results (decided_by = 'ADMIN')
- Target only CW_DAILY matches (type = 'CW_DAILY')
- Leaves battles untouched in battle tables
- Resets matches to PENDING status

As a result, ​next auto-vincular attempt will behave identically to a fresh start.
