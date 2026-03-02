# Implementation Tasks: Configurable Auto-Link Battle Matching

## Task Groups

### T.G. 1: Database Schema & Migration

**Objective**: Add battle cutoff configuration columns to season table.

**Tasks:**
1. Create migration file: `supabase/migrations/20260300000000_add_battle_cutoff_config.sql`
2. Add columns:
   ```sql
   ALTER TABLE public.season
   ADD COLUMN IF NOT EXISTS battle_cutoff_minutes INT DEFAULT 590,
   ADD COLUMN IF NOT EXISTS battle_cutoff_tz_offset TEXT DEFAULT '-03:00';
   ```
3. Add column comments explaining purpose
4. Test migration on local/test database
5. Verify existing seasons receive default values
6. Document migration in changelog

**Acceptance:**
- Migration runs idempotently (multiple runs safe)
- All seasons have default values after migration
- SELECT queries including new columns work
- No performance regression on season queries

**Estimated Effort**: 2-4 hours

---

### T.G. 2: Utility Module Development

**Objective**: Create centralized battle date calculation utilities.

**Tasks:**
1. Create file: `packages/liga-admin/src/lib/battleDateUtils.js`
2. Implement `getBattleDateKey(battleTimestamp, cutoffMinutes)`:
   - Parse timestamp to Date object
   - Subtract cutoffMinutes
   - Return ISO date string (YYYY-MM-DD)
   - Handle null/undefined inputs gracefully
3. Implement `scoreBattleQuality(battle, scheduledFrom, scheduledTo, cutoffMinutes, bestOf)`:
   - Calculate proximity score (40%)
   - Calculate completeness score (30%)
   - Calculate window fit score (20%)
   - Calculate deck validity score (10%)
   - Return score object with total and breakdown
4. Implement `selectBestBattle(candidates, ...)`:
   - Score all candidates
   - Sort by total score descending
   - Determine selection reason
   - Return winner with alternatives
5. Add JSDoc comments to all functions
6. Export functions as named exports

**Acceptance:**
- All functions have JSDoc with param/return types
- Pure functions (no side effects)
- Handle edge cases (empty arrays, null values)
- Code passes lint checks (ESLint)

**Estimated Effort**: 6-8 hours

---

### T.G. 3: Unit Testing Suite

**Objective**: Achieve 95%+ coverage on utility functions.

**Tasks:**
1. Create file: `packages/liga-admin/src/lib/battleDateUtils.test.js`
2. Test `getBattleDateKey()`:
   - Battle before cutoff → previous day
   - Battle after cutoff → same day
   - Battle at exact cutoff → same day
   - Midnight battles (00:00 UTC)
   - Month boundary (e.g., Feb 1 → Jan 31)
   - Custom cutoffs (300, 720, 1440 minutes)
3. Test `scoreBattleQuality()`:
   - Perfect battle (midpoint, complete, valid) → 100 score
   - Incomplete battle (low round_count) → lower score
   - Edge-time battle (near window boundary) → lower proximity score
   - Missing deck data → lower deck validity score
4. Test `selectBestBattle()`:
   - Single candidate → SINGLE_CANDIDATE reason
   - Clear winner (20+ point difference) → CLEAR_WINNER reason
   - Close call (<5 point difference) → CLOSE_CALL reason
   - Empty array → null result
5. Run tests with `npm test` or Jest
6. Generate coverage report, verify 95%+

**Acceptance:**
- All tests pass
- Coverage ≥95% (lines, branches, functions)
- No skipped tests
- Tests run in <5 seconds

**Estimated Effort**: 4-6 hours

---

### T.G. 4: Season Edit UI Enhancement

**Objective**: Add cutoff configuration fields to season edit form.

**Tasks:**
1. Open `packages/liga-admin/src/pages/admin/SeasonEdit.jsx`
2. Add state variables:
   - `const [battleCutoffMinutes, setBattleCutoffMinutes] = useState(590);`
   - `const [battleCutoffTzOffset, setBattleCutoffTzOffset] = useState('-03:00');`
3. Update Supabase SELECT to include new columns
4. Add UI section "Battle Auto-Link Configuration":
   - Number input for `battle_cutoff_minutes` (min: 0, max: 1440)
   - Select dropdown for `battle_cutoff_tz_offset` (options: -03:00, -05:00, +00:00, +01:00)
   - Helper text showing UTC time equivalent (e.g., "09:50 UTC = 06:50 Argentina")
   - Info box explaining how cutoff works
5. Add validation:
   - Cutoff must be 0-1440
   - Alert if invalid value
6. Update save payload to include new fields
7. Test form: save, reload, verify persistence

**Acceptance:**
- Fields render in form
- Loading existing season populates fields
- Validation prevents invalid values
- Saving persists to database
- No layout/styling issues

**Estimated Effort**: 4-6 hours

---

### T.G. 5: SeasonsList Auto-Link Refactor

**Objective**: Update auto-link to use configurable cutoff and disambiguation.

**Tasks:**
1. Open `packages/liga-admin/src/pages/admin/SeasonsList.jsx`
2. Import utility functions:
   ```javascript
   import { getBattleDateKey, selectBestBattle } from '../lib/battleDateUtils';
   ```
3. Update `autoLinkBattles()`:
   - Fetch `battle_cutoff_minutes` from season table
   - Pass cutoffMinutes to findAvailableBattle()
   - Add disambiguation counter to progress state
4. Refactor `findAvailableBattle()`:
   - Add parameters: `cutoffMinutes`, `bestOf`
   - Change buffer: from -0 to ±30 minutes
   - Fetch up to 10 battles (instead of limit 1)
   - Filter battles by scheduled date using `getBattleDateKey()`
   - Call `selectBestBattle()` if multiple candidates
   - Log disambiguation result to console
   - Return selected battle or null
5. Update progress modal to show disambiguation count (optional, can be in console only)
6. Test with mock data:
   - Single battle → links correctly
   - Multiple battles → selects best
   - No battles → skips

**Acceptance:**
- Auto-link uses season config
- Disambiguation logs appear in console
- Linked/skipped counts accurate
- No errors in console
- Progress UI updates correctly

**Estimated Effort**: 6-8 hours

---

### T.G. 6: SeasonDailyPoints Refactor

**Objective**: Replace hardcoded cutoff with season config in daily points display.

**Tasks:**
1. Open `packages/liga-admin/src/pages/admin/SeasonDailyPoints.jsx`
2. Import utility:
   ```javascript
   import { getBattleDateKey } from '../lib/battleDateUtils';
   ```
3. Add state: `const [cutoffMinutes, setCutoffMinutes] = useState(590);`
4. Add useEffect to load season config:
   ```javascript
   useEffect(() => {
     async function loadConfig() {
       const { data } = await supabase
         .from('season')
         .select('battle_cutoff_minutes')
         .eq('season_id', seasonId)
         .single();
       setCutoffMinutes(data?.battle_cutoff_minutes || 590);
     }
     loadConfig();
   }, [seasonId]);
   ```
5. Replace `getDateKey()` function body:
   ```javascript
   function getDateKey(timestamptz) {
     return getBattleDateKey(timestamptz, cutoffMinutes);
   }
   ```
6. Remove hardcoded `- 590` logic
7. Test page: verify dates displayed correctly

**Acceptance:**
- Hardcoded 590 removed
- Dates match expected game dates
- Season config loaded on mount
- No visual changes (same behavior with default cutoff)

**Estimated Effort**: 2-3 hours

---

### T.G. 7: Console Logging Enhancement

**Objective**: Structured disambiguation logs for admin audit.

**Tasks:**
1. In `findAvailableBattle()`, add console.log after disambiguation:
   ```javascript
   if (result && result.reason !== 'SINGLE_CANDIDATE') {
     console.log('[AUTO-LINK DISAMBIGUATION]', {
       scheduled_match_id: scheduledMatchId,
       player: { id: playerId, name: playerName },
       scheduled: { from: scheduledFrom, to: scheduledTo },
       candidates_count: matchingBattles.length,
       winner: {
         battle_id: result.battle.battle_id,
         battle_time: result.battle.battle_time,
         score: result.score.total,
         breakdown: result.score.breakdown
       },
       reason: result.reason,
       alternatives: result.alternatives
     });
   }
   ```
2. Add warning log for low-quality battles:
   ```javascript
   if (result && result.score.total < 30) {
     console.warn('[AUTO-LINK] Battle score too low:', {
       battle_id: result.battle.battle_id,
       score: result.score.total,
       threshold: 30
     });
     return null; // Reject battle
   }
   ```
3. Test logs appear in browser console during auto-link

**Acceptance:**
- Logs are structured (JSON-like objects)
- Logs include all relevant context
- Logs do not clutter UI (console only)
- Logs help debug incorrect links

**Estimated Effort**: 1-2 hours

---

### T.G. 8: E2E Testing

**Objective**: Comprehensive end-to-end tests covering all BDD scenarios.

**Tasks:**
1. Create file: `packages/liga-admin/tests/e2e/autolink-configurable.spec.js`
2. Test T1: Admin configures cutoff in season edit
   - Navigate to season edit
   - Change cutoff to 420 minutes
   - Save and reload
   - Verify persistence
3. Test T2: Auto-link uses season config
   - Setup: Create season with custom cutoff
   - Trigger auto-link
   - Verify correct dates in logs
4. Test T3: Disambiguation selects best battle
   - Setup: Insert 2 battles (one better quality)
   - Trigger auto-link
   - Verify better battle linked
5. Test T4: No suitable battle found (skip)
   - Setup: PENDING match, no battles
   - Trigger auto-link
   - Verify skipped count incremented
6. Test T5: Adjacent regression - Season list navigation
7. Test T6: Adjacent regression - Daily points page loads
8. Run full test suite: `npm run test:e2e -- autolink-configurable.spec.js`

**Acceptance:**
- All tests pass (7+ tests)
- Tests run in <2 minutes
- No false positives/negatives
- Adjacent regressions pass

**Estimated Effort**: 6-8 hours

---

### T.G. 9: Code Cleanup & Documentation

**Objective**: Remove hardcoded offsets, update documentation.

**Tasks:**
1. Search codebase for hardcoded `590` or `- 590`:
   ```bash
   grep -r "590" packages/liga-admin/src/
   ```
2. Replace all instances with utility function calls
3. Update `docs/openspec/changelog.md`:
   - Add entry under "## [Unreleased] ### Added"
   - Document feature overview, changes, files modified
4. Update `packages/liga-admin/README.md`:
   - Add note about battle cutoff configuration
5. Add inline comments explaining disambiguation algorithm
6. Run lint: `npm run lint`
7. Run type check: `npm run type-check` (if TypeScript)

**Acceptance:**
- No hardcoded 590-minute offsets remain
- Changelog updated with feature details
- README mentions new config option
- Code passes lint checks
- No console warnings

**Estimated Effort**: 3-4 hours

---

### T.G. 10: Performance Validation

**Objective**: Verify no performance regressions.

**Tasks:**
1. Benchmark auto-link with 100 scheduled matches:
   - Before: Current implementation
   - After: With disambiguation
   - Acceptable: <20% increase in total time
2. Profile database queries:
   - Check query plans (EXPLAIN ANALYZE)
   - Verify indexes used
   - No full table scans
3. Measure disambiguation overhead:
   - Time `selectBestBattle()` with 5 candidates
   - Target: <10ms per call
4. Test with production-like data volumes
5. Document results in performance report

**Acceptance:**
- Auto-link completes 100 matches in <90 seconds
- Disambiguation adds <10ms per match
- Database queries use indexes
- No memory leaks (check DevTools)

**Estimated Effort**: 3-4 hours

---

## Git Workflow Standards

### Branch Naming
```
feat/configurable-autolink-battle-matching
```

### Commit Convention
Use conventional commits format:

```
feat(liga-admin): add battle cutoff configuration to season edit UI

Add battle_cutoff_minutes and battle_cutoff_tz_offset fields to season
edit form. Display current UTC equivalent and timezone offset selector.

- Add state variables for cutoff config
- Update season SELECT query to include new columns
- Add UI section with number input and dropdown
- Add validation (0-1440 minutes)
- Update save payload with new fields

Closes: T.G. 4
```

**Commit Types:**
- `feat`: New feature (T.G. 2, 4, 5, 6)
- `test`: Add/update tests (T.G. 3, 8)
- `refactor`: Code structure improvements (T.G. 5, 6)
- `docs`: Documentation changes (T.G. 9)
- `perf`: Performance improvements (T.G. 10)
- `chore`: Database migrations, tooling (T.G. 1)

### Suggested Commit Sequence

1. `chore(db): add battle cutoff config columns to season table` (T.G. 1)
2. `feat(liga-admin): create battleDateUtils utility module` (T.G. 2)
3. `test(liga-admin): add unit tests for battleDateUtils` (T.G. 3)
4. `feat(liga-admin): add battle cutoff fields to season edit UI` (T.G. 4)
5. `refactor(liga-admin): update autoLinkBattles to use configurable cutoff` (T.G. 5)
6. `refactor(liga-admin): update SeasonDailyPoints to use season cutoff config` (T.G. 6)
7. `feat(liga-admin): add disambiguation logging for auto-link` (T.G. 7)
8. `test(e2e): add configurable auto-link test suite` (T.G. 8)
9. `docs: update changelog and README for configurable auto-link` (T.G. 9)
10. `perf: validate auto-link performance with disambiguation` (T.G. 10)

### Pull Request Structure

**Title:**
```
feat(liga-admin): Configurable Auto-Link Battle Matching with Disambiguation
```

**Body Template:**
```markdown
## Description
Implement configurable battle cutoff and intelligent disambiguation for auto-link feature.

## Changes Made
- [x] Added battle_cutoff_minutes and battle_cutoff_tz_offset to season table
- [x] Created battleDateUtils.js utility module
- [x] Added unit tests (95%+ coverage)
- [x] Enhanced season edit UI with cutoff configuration
- [x] Refactored autoLinkBattles with disambiguation
- [x] Updated SeasonDailyPoints to use season config
- [x] Added structured console logging
- [x] Comprehensive E2E tests
- [x] Removed all hardcoded 590-minute offsets
- [x] Performance validated (<90s for 100 matches)

## Testing Evidence
- Unit tests: 47/47 passing, 96% coverage
- E2E tests: 7/7 passing (autolink-configurable.spec.js)
- Adjacent regressions: 2/2 passing
- Performance: 100 matches in 78 seconds (baseline: 65s)

## Screenshots
- [ ] Season edit UI with cutoff fields
- [ ] Console logs showing disambiguation
- [ ] Progress modal with counters

## Architectural Review Checklist
- [x] Backward compatible (default values maintain current behavior)
- [x] No performance regressions (<20% increase acceptable)
- [x] Centralized utility (DRY principle)
- [x] Unit tests cover edge cases
- [x] E2E tests cover all BDD scenarios
- [x] Documentation updated (changelog, README)
- [x] Code follows React hooks best practices
- [x] No hardcoded magic numbers remain

## Breaking Changes
None. Existing seasons use default cutoff (590 minutes).

## Deployment Notes
1. Apply migration: `20260300000000_add_battle_cutoff_config.sql`
2. Deploy frontend changes
3. Monitor auto-link runs for 1 week
4. Tune disambiguation scoring if needed

---

**Related Issues:** configurable-autolink-battle-matching  
**OpenSpec Change:** openspec/changes/configurable-autolink-battle-matching/  
**Commit Hash:** (generated after merge)
```

---

## Implementation Sequence

### Phase 1: Foundation (Week 1)
- T.G. 1 (Migration)
- T.G. 2 (Utility Module)
- T.G. 3 (Unit Tests)

### Phase 2: UI Integration (Week 2)
- T.G. 4 (Season Edit UI)
- T.G. 5 (Auto-Link Refactor)
- T.G. 6 (Daily Points Refactor)
- T.G. 7 (Logging)

### Phase 3: Testing & Polish (Week 2-3)
- T.G. 8 (E2E Tests)
- T.G. 9 (Documentation)
- T.G. 10 (Performance)

### Phase 4: Review & Deploy (Week 3)
- Code review by Architect
- PR merge approval
- Deploy to test environment
- Monitor auto-link runs
- Deploy to production

---

## Acceptance Criteria for PR Approval

**Functional:**
- ✅ All 12 BDD scenarios pass
- ✅ Season edit UI saves/loads cutoff config
- ✅ Auto-link uses season cutoff (verified in logs)
- ✅ Disambiguation selects highest-quality battles
- ✅ No hardcoded 590-minute offsets remain

**Technical:**
- ✅ Unit test coverage ≥95%
- ✅ E2E tests pass (7+ tests)
- ✅ Code passes lint checks
- ✅ No console errors during testing
- ✅ Performance benchmarks met

**Documentation:**
- ✅ Changelog updated
- ✅ README mentions feature
- ✅ JSDoc comments on all functions
- ✅ Inline comments explain complex logic

**Quality:**
- ✅ Backward compatible (old seasons work)
- ✅ Migration idempotent
- ✅ No breaking changes
- ✅ Architect review approved

---

## Rollback Plan

If issues arise post-deployment:
1. Frontend rollback: Revert to previous commit (config fields optional)
2. Database: Columns remain (default values safe to leave)
3. Hotfix: Set all season cutoffs to 590 via SQL update
4. Re-evaluate: Test in isolated environment, redeploy

---

## Post-Deployment Monitoring

**Week 1:**
- Monitor auto-link runs: check linked/skipped ratios
- Review console logs for disambiguation patterns
- Collect admin feedback on cutoff configuration
- Watch for performance issues (query timeouts)

**Week 2-3:**
- Analyze disambiguation decisions (correct vs incorrect)
- Tune scoring weights if needed (requires code change)
- Consider adding disambiguation UI (future enhancement)

**Success Metrics:**
- <5% manual re-link rate (down from ~15%)
- 80%+ of new seasons use custom cutoff
- 90%+ disambiguation cases resolved correctly
- No performance degradation

---

**Status**: Ready for Implementation  
**Estimated Total Effort**: 40-50 hours (2-3 weeks)  
**Dependencies**: None  
**Risk Level**: Low (additive, backward compatible)
