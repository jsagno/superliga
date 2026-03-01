# Apply Supabase Migrations - Quick Guide

## Current Issue
Your app is pointing to HOSTED Supabase, but the migration hasn't been applied there.
Error: `column season.days_per_round does not exist`

---

## ✅ RECOMMENDED: Use Local Supabase for Development

### Step 1: Reset Local Database with All Migrations
```bash
cd d:\LigaInterna
supabase db reset
```

This will:
- Drop and recreate your local database
- Apply ALL migrations in order (including days_per_round)
- Run seed.sql to populate initial data

### Step 2: Update .env to Use Local Instance
```bash
cd packages\liga-admin

# Backup current .env
Copy-Item .env .env.hosted

# Update to use local
@"
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH
"@ | Set-Content .env
```

### Step 3: Restart Dev Server
```bash
npm run dev
```

**Benefits**:
- ✅ Safe testing without affecting production
- ✅ Fast reset/rollback with `supabase db reset`
- ✅ All migrations applied automatically
- ✅ Seed data available

---

## Alternative: Apply Migration to HOSTED Instance

⚠️ **Warning**: This modifies your production database!

### Step 1: Link to Remote Project
```bash
cd d:\LigaInterna
supabase link --project-ref kivlwozjpijejrubapcw
```

### Step 2: Push Migration
```bash
supabase db push
```

This will apply the `20260301000000_add_days_per_round.sql` migration to your hosted instance.

---

## Quick PowerShell Commands

### Apply to LOCAL (Recommended)
```powershell
cd d:\LigaInterna

# Reset database with all migrations
supabase db reset

# Switch to local environment
cd packages\liga-admin
Copy-Item .env .env.hosted
@"
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH
"@ | Set-Content .env

Write-Host "✅ Now restart your dev server: npm run dev" -ForegroundColor Green
```

### Apply to HOSTED (Production)
```powershell
cd d:\LigaInterna
supabase link --project-ref kivlwozjpijejrubapcw
supabase db push
```

---

## Troubleshooting

**"supabase db reset fails"**
- Stop local containers: `supabase stop`
- Start fresh: `supabase start`
- Try reset again: `supabase db reset`

**"Changes not appearing in app"**
- Hard refresh browser (Ctrl+Shift+R)
- Check which .env is loaded: `echo $env:VITE_SUPABASE_URL`
- Restart dev server

**"Local database is empty"**
- Check seed.sql exists: `Test-Path supabase\seed.sql`
- Manually seed: `supabase db reset` applies seed.sql automatically

---

## Recommended Workflow

1. **Development**: Use LOCAL Supabase (`http://127.0.0.1:54321`)
2. **Testing**: Test features locally first
3. **Deploy**: Push migrations to hosted when ready
   ```bash
   supabase link --project-ref kivlwozjpijejrubapcw
   supabase db push
   ```

---

## Check Current Configuration

```powershell
# What database are you pointing to?
Get-Content packages\liga-admin\.env

# Is local Supabase running?
supabase status

# What migrations are applied locally?
supabase migration list
```
