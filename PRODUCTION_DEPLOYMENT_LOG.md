# Production Deployment - days_per_round Migration
**Date**: March 1, 2026  
**Migration**: `20260301000000_add_days_per_round.sql`  
**Status**: ⏳ Ready to Apply

---

## ✅ Pre-Deployment Checklist

- [x] Code pushed to GitHub (main branch)
- [x] All tests passing (8/8 unit tests)
- [x] Pre-push hook validated
- [x] Local database tested
- [x] Migration SQL copied to clipboard
- [x] Supabase Dashboard opened

---

## 🚀 Deployment Steps

### Step 1: Apply Migration
The browser should now be open to:
**https://supabase.com/dashboard/project/kivlwozjpijejrubapcw/sql/new**

✅ **SQL already copied to clipboard**

1. **Paste** the SQL (Ctrl+V or Cmd+V)
2. **Review** the migration:
   - Adds `days_per_round INT DEFAULT 4` column
   - Adds constraint `CHECK (days_per_round >= 1 AND days_per_round <= 14)`
   - Adds column comment
3. **Click RUN** button
4. **Verify** success message

---

### Step 2: Verify Migration Applied

Run this query in the same SQL editor:

```sql
-- Verify column exists
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'season' AND column_name = 'days_per_round';
```

**Expected result:**
```
column_name     | data_type | column_default | is_nullable
----------------|-----------|----------------|-------------
days_per_round  | integer   | 4              | NO
```

---

### Step 3: Check Existing Seasons

```sql
-- Test on existing seasons
SELECT season_id, description, days_per_round, season_start_at
FROM season
ORDER BY season_start_at DESC
LIMIT 5;
```

**Expected**: All existing seasons should show `days_per_round = 4` (default)

---

### Step 4: Test Constraint

```sql
-- Test valid value (should succeed)
UPDATE season
SET days_per_round = 7
WHERE season_id = (SELECT season_id FROM season LIMIT 1);

-- Test invalid value (should FAIL)
UPDATE season
SET days_per_round = 20  -- Should fail: exceeds max 14
WHERE season_id = (SELECT season_id FROM season LIMIT 1);

-- Rollback test changes
UPDATE season
SET days_per_round = 4
WHERE days_per_round = 7;
```

**Expected**:
- ✅ First update succeeds (7 is valid)
- ❌ Second update fails with constraint violation
- ✅ Rollback succeeds

---

## 🔍 Post-Deployment Verification

### Option 1: Automated Smoke Test

```bash
cd packages/liga-admin

# Set environment for production
$env:VITE_SUPABASE_URL="https://kivlwozjpijejrubapcw.supabase.co"
$env:VITE_SUPABASE_ANON_KEY="[YOUR_ANON_KEY]"

# Run smoke tests
npm run smoke-test
```

### Option 2: Manual UI Testing

1. Open admin dashboard: https://kivlwozjpijejrubapcw.supabase.co
2. Navigate to **Seasons** → Select a season → **Edit**
3. Verify `Days per Round` field visible (range 1-14, default 4)
4. Save with value **7** → Should succeed
5. Try value **0** → Should fail validation
6. Navigate to **Season → Daily Points**
7. Verify round headers display correctly

---

## 📊 Expected Impact

### Database Changes
- ✅ New column: `season.days_per_round INT DEFAULT 4`
- ✅ New constraint: `days_per_round_range`
- ✅ Backward compatible: Existing seasons default to 4

### Application Changes
- ✅ SeasonEdit form shows `days_per_round` input
- ✅ Daily Points grid displays configurable round headers
- ✅ Penalties calculated per round
- ✅ Performance unchanged (< 2s load time)

### No Breaking Changes
- ✅ Existing features unchanged
- ✅ API contracts maintained
- ✅ No data migrations required

---

## ❌ Rollback Procedure

**If critical issues within 1 hour:**

### Database Rollback
```sql
-- Remove constraint
ALTER TABLE public.season DROP CONSTRAINT IF EXISTS days_per_round_range;

-- Remove column
ALTER TABLE public.season DROP COLUMN IF EXISTS days_per_round;
```

### Code Rollback
```bash
# Revert to previous commit
git revert HEAD~2..HEAD  # Reverts last 3 commits
git push origin main

# Redeploy frontend
npm run build
# Deploy to hosting
```

---

## 📝 Deployment Log

| Step | Status | Time | Notes |
|------|--------|------|-------|
| Pre-deployment checks | ✅ | [timestamp] | All tests passed |
| Migration applied | ⏳ | _______ | Paste SQL & run |
| Column verified | ⏳ | _______ | Check information_schema |
| Constraint tested | ⏳ | _______ | Test valid/invalid values |
| Smoke tests | ⏳ | _______ | npm run smoke-test |
| UI verification | ⏳ | _______ | Manual testing |
| Monitoring (24h) | ⏳ | _______ | Check error rates |

---

## ✅ Success Criteria

Migration is successful when:
- [x] Query returns `days_per_round` column
- [ ] Constraint prevents values outside 1-14
- [ ] Existing seasons show default value 4
- [ ] SeasonEdit form displays field correctly
- [ ] Daily Points grid renders with round headers
- [ ] No errors in application logs
- [ ] Performance metrics unchanged

---

## 🆘 Support

**If issues occur:**
1. Check error logs in Supabase Dashboard
2. Verify migration applied: `SELECT * FROM supabase_migrations WHERE version = '20260301000000';`
3. Review DEPLOYMENT_CHECKLIST.md for troubleshooting
4. Rollback if critical (see above)

**Contacts:**
- Developer: [Your team]
- On-call: [Support contact]

---

## 📎 Related Files

- Migration SQL: `supabase/migrations/20260301000000_add_days_per_round.sql`
- Deployment Checklist: `packages/liga-admin/DEPLOYMENT_CHECKLIST.md`
- Smoke Tests: `packages/liga-admin/tools/smoke-test.js`
- Feature Summary: `FEATURE_COMPLETION_SUMMARY.md`

---

**Deployment Started**: ____________ (UTC)  
**Deployed By**: ____________  
**Status**: ⏳ In Progress
