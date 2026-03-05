# Schema Synchronization Report

## Current Status

### 🔴 Migration History Issues Detected

The Supabase CLI detected that your **local migration history doesn't match production**:

**Production has:**
- ❌ 20260227011458 (reverted/failed)
- ❌ 20260228234329 (reverted/failed)  
- ❌ 20260301022439 (reverted/failed)
- ✅ 20260228110000_add_duel_end_date_and_canceled_status.sql
- ✅ 20260300000000_add_battle_cutoff_config.sql
- ✅ 20260301000000_add_days_per_round.sql

**Local has:**
- ✅ 20260124220000_initial_schema.sql
- ✅ 20260124220001_production_schema.sql
- ✅ 20260226000000_add_extreme_config_disable_flag.sql
- ⏸️ 20260227011458_remote_schema.sql.skip (intentionally skipped)
- ⏳ 20260228000000_add_season_card_restriction.sql
- ✅ 20260228110000_add_duel_end_date_and_canceled_status.sql
- ✅ 20260300000000_add_battle_cutoff_config.sql
- ✅ 20260301000000_add_days_per_round.sql

## Recommended Solution

### Option A: Force Local → Production (Recommended for this project)
Use local as source of truth:

```bash
supabase db push --force-push
```

This will:
1. Mark failed migrations as reverted in production
2. Apply local migrations that are missing
3. Ensure production schema matches local

### Option B: Pull Production → Local
Revert to production as source of truth:

```bash
supabase migration repair --status reverted 20260227011458
supabase migration repair --status reverted 20260228234329
supabase migration repair --status reverted 20260301022439
supabase migration repair --status applied 20260228110000
supabase migration repair --status applied 20260300000000
supabase migration repair --status applied 20260301000000
```

Then restart local:
```bash
supabase stop
supabase start
```

## Verification Steps

After choosing an option, verify the local database has all required columns for CRON auto-linking:

### Execute in Supabase SQL Editor (or psql)

```sql
-- 1. Verify required tables exist
SELECT tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN (
    'scheduled_match',
    'scheduled_match_battle_link', 
    'scheduled_match_result',
    'season',
    'admin_user'
  )
ORDER BY tablename;

-- 2. Verify linked_by_admin column exists
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'scheduled_match_battle_link'
  AND column_name = 'linked_by_admin';

-- 3. Verify season has battle_cutoff_minutes
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'season'
  AND column_name = 'battle_cutoff_minutes';

-- 4. Verify admin_user table exists and has user_id
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'admin_user'
  AND column_name IN ('user_id', 'created_at');
```

Expected results:
- ✅ All 5 tables exist in public schema
- ✅ linked_by_admin column present (uuid type)
- ✅ battle_cutoff_minutes column present (integer type)
- ✅ admin_user.user_id and created_at columns present

## For CRON Auto-Linking Testing

Once schema is synced, verify the local database:

1. **Local Supabase Status:**
   ```bash
   supabase status
   ```
   Should show port 54322 for database

2. **Connect to local database:**
   ```bash
   PGPASSWORD=postgres psql -h localhost -p 54322 -U postgres -d postgres
   ```

3. **Run schema verification:**
   ```sql
   \dt -- List tables
   
   -- Check key columns
   \d scheduled_match
   \d scheduled_match_battle_link
   \d season
   ```

## Next: Testing CRON Auto-Linking

Once schema is verified as in-sync:

1. Execute the cleanup script for today's data
2. Restart CRON with updated code
3. Monitor CRON logs for successful battle linking
4. Verify results in daily-points grid

---

**Questions?**
- Check migration status: `supabase migration list`
- View local database: `supabase studio` (http://127.0.0.1:54323)
- See logs: `supabase log --follow`
