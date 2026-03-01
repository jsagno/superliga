# Daily Points Feature - Deployment Checklist

## Pre-Deployment Verification ✓

### Code Review
- [ ] **CR.1** Code changes reviewed and approved
- [ ] **CR.2** No TypeScript compilation errors (`npm run build`)
- [ ] **CR.3** ESLint passes with no warnings (`npm run lint`)
- [ ] **CR.4** All unit tests pass (`npm run test:unit`)
- [ ] **CR.5** No console errors in dev mode

### Database Migrations
- [ ] **DB.1** Migration file exists: `20260301000000_add_days_per_round.sql`
- [ ] **DB.2** Migration tested locally: `supabase db reset`
- [ ] **DB.3** `days_per_round` column verified in schema
- [ ] **DB.4** Constraint `days_per_round BETWEEN 1 AND 14` is active
- [ ] **DB.5** Existing seasons can be updated with new field

### Feature Verification
- [ ] **FT.1** SeasonEdit form accepts `days_per_round` input (1-14)
- [ ] **FT.2** Daily points grid displays with round headers
- [ ] **FT.3** Consecutive miss penalties calculated correctly
- [ ] **FT.4** Legend displays penalty explanation
- [ ] **FT.5** Backward compatibility: seasons without `days_per_round` default to 4
- [ ] **FT.6** Player exclusion after 4 consecutive misses works

### Performance Testing
- [ ] **PERF.1** Grid renders with 50+ dates in < 2 seconds
- [ ] **PERF.2** Grid renders with 200+ players in < 2 seconds
- [ ] **PERF.3** No memory leaks with long session times
- [ ] **PERF.4** Scroll performance smooth (60 FPS) with sticky headers

### Testing Artifacts
- [ ] **TEST.1** Unit tests documented and passing
- [ ] **TEST.2** E2E tests (Playwright) passing
- [ ] **TEST.3** Manual UI testing completed and documented
- [ ] **TEST.4** Adjacent regression flows tested

### Documentation
- [ ] **DOC.1** Business rules updated in [docs/openspec/business-rules/scoring-system.md](../docs/openspec/business-rules/scoring-system.md)
- [ ] **DOC.2** Component JSDoc comments complete
- [ ] **DOC.3** README updated with round grouping feature
- [ ] **DOC.4** Changelog entry added
- [ ] **DOC.5** Deployment notes saved

---

## Deployment Steps

### 1. Production Database Migration

```bash
# From repository root
supabase link --project-ref kvlwozjpijejrubapcw
supabase migration list  # Verify pending migrations

# Apply migration to production
supabase db push

# Verify migration succeeded
supabase migration list  # Should show 20260301000000 as applied
```

**Rollback Plan** (if needed):
```bash
# Revert migration
supabase migration down
# OR manually:
# ALTER TABLE public.season DROP COLUMN days_per_round;
```

### 2. Code Deployment

```bash
# Build production bundle
npm run build

# Verify bundle size reasonable
ls -lh dist/

# Deploy to hosting (your provider specific steps)
```

### 3. Post-Deployment Verification

```bash
# Run smoke tests against production
VITE_SUPABASE_URL="https://kivlwozjpijejrubapcw.supabase.co" \
VITE_SUPABASE_ANON_KEY="..." \
npm run smoke-test

# Manual testing checklist:
```

- [ ] Open admin dashboard
- [ ] Navigate to Season → Daily Points
- [ ] Verify grid displays round headers correctly
- [ ] Check that penalties display in red
- [ ] Confirm player exclusion after 4 misses
- [ ] Test filtering by player/team still works
- [ ] Check responsive design on mobile/tablet

### 4. Monitoring

Monitor for 24 hours:
- [ ] Error rate normal (no spike in logs)
- [ ] Database query performance acceptable
- [ ] No missing `days_per_round` related errors
- [ ] Player feedback on UI/UX neutral or positive

---

## Communication Plan

### Before Deployment
- [ ] Notify team in #development channel
- [ ] Estimated downtime (if any): ___ minutes
- [ ] Expected deployment time: ___

### During Deployment
- [ ] Update status in #deployments channel
- [ ] Document any issues encountered

### After Deployment
- [ ] Confirm feature working to team
- [ ] Share release notes with stakeholders
- [ ] Archive this checklist with timestamp

---

## Success Criteria

✅ **Feature is successful if:**
1. All tests pass (unit, E2E, smoke)
2. Daily points grid displays correctly with new round grouping
3. Penalties apply and display correctly
4. Performance remains acceptable
5. No regressions in other features
6. Team feedback positive after 24-hour observation

---

## Rollback Procedure

**If critical issues found within 1 hour:**

```bash
# Step 1: Revert code to previous version
git revert HEAD

# Step 2: Redeploy to hosting

# Step 3: Revert database (if needed)
supabase migration down
# Manually reset: ALTER TABLE public.season DROP COLUMN days_per_round;

# Step 4: Notify team and document issue
```

**Issues requiring rollback:**
- Daily points grid not loading
- Database query errors
- Performance degradation
- Player data corruption

---

## Deployment Time

- **Planned Date**: ___________
- **Planned Time (UTC)**: ___________
- **Estimated Duration**: 15-30 minutes
- **Team Lead**: ___________
- **Backup Person**: ___________

---

## Sign-Off

- [ ] Developer: __________ Date: __________
- [ ] Architect: __________ Date: __________
- [ ] QA/Tester: __________ Date: __________

---

## Post-Deployment Notes

```
[Document any issues, unexpected behaviors, or learning points]
```
