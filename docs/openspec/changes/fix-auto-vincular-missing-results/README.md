# Fix: Auto-Vincular Missing Results

**Change ID:** `fix-auto-vincular-missing-results`  
**Status:** 🟡 In Progress  
**Created:** 2026-03-01  
**Priority:** HIGH  
**Type:** Bug Fix / Data Integrity

---

## Problem

The "Auto-vincular" process in the admin seasons page is not creating `scheduled_match_result` records when linking battles to scheduled matches. This causes:

1. **Incorrect penalties:** Players receive -1 penalties for matches they actually played
2. **Inaccurate standings:** Daily points grid shows wrong data
3. **Data integrity issues:** scheduled_match_battle_link exists but scheduled_match_result doesn't

### Example

- **Player:** Guille
- **Date:** 2026-02-22
- **Issue:** Grid shows -1 penalty
- **Expected:** Should show 1 point (battle was played)
- **Root Cause:** No `scheduled_match_result` record exists despite battle existing

---

## Scope

### In Scope
- ✅ Identify all affected scheduled_match records
- ✅ Create SQL script to repair missing results
- ✅ Fix auto-vincular code to prevent future occurrences
- ✅ Add tests to verify correct behavior
- ✅ Update documentation

### Out of Scope
- ❌ Changes to daily points grid logic (already working correctly)
- ❌ Changes to penalty calculation (already correct)
- ❌ Batch processing improvements (can be separate change)

---

## Artifacts

| Artifact | Purpose | Status |
|----------|---------|--------|
| [meta.yaml](./meta.yaml) | Change metadata | ✅ Created |
| [tasks.md](./tasks.md) | Task tracking | ✅ Created |
| [investigation-report.md](./investigation-report.md) | Investigation findings | 🟡 In Progress |
| fix-script.sql | Data repair SQL | ⏳ Not Started |
| root-cause-analysis.md | Code analysis | ⏳ Not Started |
| test-plan.md | Testing strategy | ⏳ Not Started |

---

## Investigation Status

### Phase 1: Data Assessment 🟡 IN PROGRESS

**Current Task:** Run comprehensive SQL query to find all affected matches

**Query Ready:**
```sql
-- Find ALL scheduled_match records with no result (potential missing links)
SELECT sm.scheduled_match_id, sm.scheduled_from, DATE(sm.scheduled_from) as match_date,
       p.nick as player_nickname, link_status, result_status
FROM public.scheduled_match sm
INNER JOIN public.player p ON sm.player_a_id = p.player_id
LEFT JOIN public.scheduled_match_battle_link smbl ON sm.scheduled_match_id = smbl.scheduled_match_id
LEFT JOIN public.scheduled_match_result smr ON sm.scheduled_match_id = smr.scheduled_match_id
WHERE sm.type = 'CW_DAILY'
  AND sm.scheduled_from < NOW()
  AND smr.scheduled_match_id IS NULL
ORDER BY sm.scheduled_from DESC
LIMIT 50;
```

**Next:** Run query and document findings in investigation-report.md

---

## Technical Context

### Database Schema

**scheduled_match** → **scheduled_match_battle_link** ← **battle**  
**scheduled_match** → **scheduled_match_result** ⚠️ **MISSING**

### Expected Flow

1. User clicks "Auto-vincular" in admin/seasons
2. System finds battles in match time window
3. System creates **scheduled_match_battle_link** ✅
4. System creates **scheduled_match_result** with calculated points ❌ **NOT HAPPENING**

### Current Bug

Step 4 is not being executed, leaving matches without results.

---

## Success Criteria

### Data Repair
- [ ] All past matches with battles have scheduled_match_result records
- [ ] Point calculations are accurate
- [ ] Daily points grid shows correct data
- [ ] Guille's 2/22 shows 1 point (not -1)

### Code Fix
- [ ] Auto-vincular creates both link AND result
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] No regressions in daily points grid

### Verification
- [ ] Production data verified correct
- [ ] No new occurrences for 1 week
- [ ] No user-reported discrepancies

---

## Related Work

- **Parent Change:** [daily-points-round-grouping-penalties](../daily-points-round-grouping-penalties/)
- **Affected Component:** SeasonsList.jsx (Auto-vincular)
- **Affected Tables:** scheduled_match, scheduled_match_result, scheduled_match_battle_link
- **Related Spec:** [scheduled-match.md](../../specs/scheduled-match.md) (if exists)

---

## Timeline

| Phase | Status | ETA |
|-------|--------|-----|
| 1. Data Assessment | 🟡 In Progress | Day 1 |
| 2. Root Cause Analysis | ⏳ Not Started | Day 1-2 |
| 3. Data Repair | ⏳ Not Started | Day 2 |
| 4. Code Fix | ⏳ Not Started | Day 2-3 |
| 5. Verification | ⏳ Not Started | Day 3-7 |

**Target Completion:** 2026-03-05 (data repair), 2026-03-08 (full verification)

---

## How to Contribute

1. **Start with Phase 1:** Run the SQL query above
2. **Document findings:** Update investigation-report.md
3. **Review code:** Check SeasonsList.jsx auto-vincular implementation
4. **Create fix:** Follow tasks in tasks.md
5. **Test thoroughly:** Use test-plan.md when created

---

## Questions?

- **Data Issues:** Ping Architect Agent
- **Code Review:** Ping Developer Agent
- **Product Impact:** Ping Product Manager Agent
- **Deployment:** Follow standard deployment checklist

---

## Changelog

- **2026-03-01:** Change created, investigation started
- **2026-03-01:** SQL query prepared for data assessment
- **2026-03-01:** Investigation report initiated

---

**Status Legend:**
- ✅ Complete
- 🟡 In Progress
- ⏳ Not Started
- ❌ Blocked
