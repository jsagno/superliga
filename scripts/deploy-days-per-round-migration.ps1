#!/usr/bin/env pwsh
# Production Migration Deployment Script
# Applies: 20260301000000_add_days_per_round.sql
# Date: March 1, 2026

Write-Host "🚀 Production Database Migration - days_per_round" -ForegroundColor Blue
Write-Host ""

$projectRef = "kivlwozjpijejrubapcw"
$migrationFile = "supabase/migrations/20260301000000_add_days_per_round.sql"

# Check if migration file exists
if (-not (Test-Path $migrationFile)) {
    Write-Host "❌ Migration file not found: $migrationFile" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Migration file found: $migrationFile" -ForegroundColor Green
Write-Host ""

# Read migration content
$migrationSQL = Get-Content $migrationFile -Raw

Write-Host "📋 Migration SQL:" -ForegroundColor Yellow
Write-Host "─" * 80 -ForegroundColor Gray
Write-Host $migrationSQL -ForegroundColor White
Write-Host "─" * 80 -ForegroundColor Gray
Write-Host ""

# Options for deployment
Write-Host "🔧 Deployment Options:" -ForegroundColor Cyan
Write-Host ""
Write-Host "Option 1: Supabase Dashboard (RECOMMENDED)" -ForegroundColor Green
Write-Host "  1. Open: https://supabase.com/dashboard/project/$projectRef/sql/new" -ForegroundColor White
Write-Host "  2. Paste the SQL above" -ForegroundColor White
Write-Host "  3. Click 'Run'" -ForegroundColor White
Write-Host ""

Write-Host "Option 2: psql Command Line" -ForegroundColor Yellow
Write-Host "  Connection string format:" -ForegroundColor White
Write-Host "  postgresql://postgres:[YOUR-PASSWORD]@db.$projectRef.supabase.co:5432/postgres" -ForegroundColor Gray
Write-Host ""
Write-Host "  Command:" -ForegroundColor White
Write-Host "  psql 'postgresql://postgres:[PASSWORD]@db.$projectRef.supabase.co:5432/postgres' -f $migrationFile" -ForegroundColor Gray
Write-Host ""

Write-Host "Option 3: Copy SQL to clipboard" -ForegroundColor Yellow
$copyToClipboard = Read-Host "Copy SQL to clipboard? (y/n)"

if ($copyToClipboard -eq "y") {
    $migrationSQL | Set-Clipboard
    Write-Host "✅ SQL copied to clipboard!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Now:" -ForegroundColor Cyan
    Write-Host "  1. Open Supabase Dashboard SQL Editor" -ForegroundColor White
    Write-Host "  2. Paste (Ctrl+V)" -ForegroundColor White
    Write-Host "  3. Run the query" -ForegroundColor White
    Write-Host ""
}

Write-Host "📖 Documentation:" -ForegroundColor Cyan
Write-Host "  - Deployment Checklist: packages/liga-admin/DEPLOYMENT_CHECKLIST.md" -ForegroundColor White
Write-Host "  - Smoke Tests: npm run smoke-test" -ForegroundColor White
Write-Host ""

# Verification queries
Write-Host "🔍 Verification Queries (run after migration):" -ForegroundColor Magenta
Write-Host ""
Write-Host "-- Check column exists" -ForegroundColor Gray
Write-Host "SELECT column_name, data_type, column_default" -ForegroundColor White
Write-Host "FROM information_schema.columns" -ForegroundColor White
Write-Host "WHERE table_name = 'season' AND column_name = 'days_per_round';" -ForegroundColor White
Write-Host ""
Write-Host "-- Check constraint exists" -ForegroundColor Gray
Write-Host "SELECT conname, contype, consrc" -ForegroundColor White
Write-Host "FROM pg_constraint" -ForegroundColor White
Write-Host "WHERE conname = 'days_per_round_range';" -ForegroundColor White
Write-Host ""
Write-Host "-- Test on existing season" -ForegroundColor Gray
Write-Host "SELECT season_id, description, days_per_round FROM season LIMIT 5;" -ForegroundColor White
Write-Host ""

$openBrowser = Read-Host "Open Supabase Dashboard SQL Editor? (y/n)"

if ($openBrowser -eq "y") {
    $url = "https://supabase.com/dashboard/project/$projectRef/sql/new"
    Write-Host "🌐 Opening: $url" -ForegroundColor Blue
    Start-Process $url
}

Write-Host ""
Write-Host "✅ Ready to deploy!" -ForegroundColor Green
Write-Host ""
Write-Host "After running migration, verify with:" -ForegroundColor Yellow
Write-Host "  cd packages/liga-admin && npm run smoke-test" -ForegroundColor White
