# Migration script to move files to monorepo structure
# Run from LigaInterna root directory

Write-Host "🚀 LigaInterna Monorepo Migration Script" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Step 1: Move liga-admin files
Write-Host "📦 Step 1: Moving liga-admin files..." -ForegroundColor Yellow
if (Test-Path ".\liga-admin") {
    Get-ChildItem -Path ".\liga-admin" -Exclude ".git" | ForEach-Object {
        $dest = ".\packages\liga-admin\$($_.Name)"
        Write-Host "  Moving $($_.Name) to packages/liga-admin/"
        Move-Item -Path $_.FullName -Destination $dest -Force
    }
    Write-Host "  ✓ liga-admin files moved" -ForegroundColor Green
} else {
    Write-Host "  ⚠ liga-admin directory not found, skipping" -ForegroundColor Yellow
}

# Step 2: Move cron files
Write-Host "`n📦 Step 2: Moving cron files..." -ForegroundColor Yellow
if (Test-Path ".\cron") {
    Get-ChildItem -Path ".\cron" -Exclude ".git" | ForEach-Object {
        $dest = ".\packages\cron\$($_.Name)"
        Write-Host "  Moving $($_.Name) to packages/cron/"
        Move-Item -Path $_.FullName -Destination $dest -Force
    }
    Write-Host "  ✓ cron files moved" -ForegroundColor Green
} else {
    Write-Host "  ⚠ cron directory not found, skipping" -ForegroundColor Yellow
}

# Step 3: Move openspec to docs
Write-Host "`n📚 Step 3: Moving openspec to docs..." -ForegroundColor Yellow
if (Test-Path ".\openspec") {
    if (-not (Test-Path ".\docs\openspec")) {
        New-Item -ItemType Directory -Path ".\docs\openspec" -Force | Out-Null
    }
    Get-ChildItem -Path ".\openspec" | ForEach-Object {
        $dest = ".\docs\openspec\$($_.Name)"
        Write-Host "  Moving $($_.Name) to docs/openspec/"
        Move-Item -Path $_.FullName -Destination $dest -Force
    }
    Write-Host "  ✓ openspec moved" -ForegroundColor Green
} else {
    Write-Host "  ⚠ openspec directory not found, skipping" -ForegroundColor Yellow
}

# Step 4: Move docs/REGALAMENTO.md if needed
Write-Host "`n📄 Step 4: Organizing documentation..." -ForegroundColor Yellow
if (Test-Path ".\docs\REGALAMENTO.md") {
    Write-Host "  ✓ REGALAMENTO.md already in docs/" -ForegroundColor Green
} elseif (Test-Path ".\REGALAMENTO.md") {
    Write-Host "  Moving REGALAMENTO.md to docs/"
    Move-Item -Path ".\REGALAMENTO.md" -Destination ".\docs\REGALAMENTO.md" -Force
    Write-Host "  ✓ REGALAMENTO.md moved" -ForegroundColor Green
}

# Step 5: Move supabase to shared/database (keep original for now)
Write-Host "`n🗄️  Step 5: Organizing database files..." -ForegroundColor Yellow
if (Test-Path ".\supabase") {
    Write-Host "  ✓ supabase directory exists at root (keeping it there)" -ForegroundColor Green
    
    # Copy key files to shared/database for reference
    if (Test-Path ".\supabase\seed.sql") {
        Copy-Item ".\supabase\seed.sql" ".\shared\database\schema.sql" -Force
        Write-Host "  ✓ Copied seed.sql to shared/database/schema.sql" -ForegroundColor Green
    }
}

# Step 6: Clean up empty directories
Write-Host "`n🧹 Step 6: Cleaning up empty directories..." -ForegroundColor Yellow
@(".\liga-admin", ".\cron", ".\openspec") | ForEach-Object {
    if (Test-Path $_) {
        $items = Get-ChildItem -Path $_ -Force
        if ($items.Count -eq 0) {
            Write-Host "  Removing empty directory: $_"
            Remove-Item -Path $_ -Force
        } else {
            Write-Host "  ⚠ $_ still has files, not removing" -ForegroundColor Yellow
        }
    }
}

# Step 7: Create package READMEs
Write-Host "`n📝 Step 7: Creating package README files..." -ForegroundColor Yellow

# CRON README
$cronReadme = @"
# CRON - Battle Synchronization Engine

Python-based service that syncs battle data from Supercell API to Supabase.

## Quick Start

``````bash
# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your credentials

# Run sync
python cron_clash_sync.py
``````

## Documentation

- **Product Spec**: [../../docs/openspec/products/cron.md](../../docs/openspec/products/cron.md)
- **Battle Ingestion**: [../../docs/openspec/features/cron/battle-ingestion.md](../../docs/openspec/features/cron/battle-ingestion.md)
- **Architecture**: [../../docs/openspec/architecture/system-overview.md](../../docs/openspec/architecture/system-overview.md)

## Environment Variables

``````env
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPERCELL_TOKEN=your-supercell-token
CLAN_TAG=#PUGCG80C
``````
"@

if (-not (Test-Path ".\packages\cron\README.md")) {
    $cronReadme | Out-File -FilePath ".\packages\cron\README.md" -Encoding utf8
    Write-Host "  ✓ Created packages/cron/README.md" -ForegroundColor Green
}

# LIGA-ADMIN README
$adminReadme = @"
# LIGA-ADMIN - Tournament Management Dashboard

React 19 admin interface for managing competitive seasons.

## Quick Start

``````bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your Supabase credentials

# Start dev server
npm run dev
``````

## Documentation

- **Product Spec**: [../../docs/openspec/products/liga-admin.md](../../docs/openspec/products/liga-admin.md)
- **Features**: [../../docs/openspec/features/liga-admin/](../../docs/openspec/features/liga-admin/)
- **Architecture**: [../../docs/openspec/architecture/system-overview.md](../../docs/openspec/architecture/system-overview.md)

## Environment Variables

``````env
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-anon-key
``````
"@

if (-not (Test-Path ".\packages\liga-admin\README.md")) {
    $adminReadme | Out-File -FilePath ".\packages\liga-admin\README.md" -Encoding utf8
    Write-Host "  ✓ Created packages/liga-admin/README.md" -ForegroundColor Green
}

# Step 8: Git instructions
Write-Host "`n🔧 Step 8: Git Repository Setup" -ForegroundColor Yellow
Write-Host "  Current status:" -ForegroundColor Cyan

$gitFolders = @(".\packages\liga-admin\.git", ".\packages\cron\.git", ".\.git")
$hasGit = $false

foreach ($gitPath in $gitFolders) {
    if (Test-Path $gitPath) {
        Write-Host "    • Found git repository at: $gitPath" -ForegroundColor Yellow
        $hasGit = $true
    }
}

if ($hasGit) {
    Write-Host "`n  ⚠️  Action Required: Remove old git repositories" -ForegroundColor Red
    Write-Host "  Run these commands to clean up:" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  # Remove git from packages (if they have separate repos)" -ForegroundColor Gray
    Write-Host "  Remove-Item -Recurse -Force .\packages\liga-admin\.git" -ForegroundColor White
    Write-Host "  Remove-Item -Recurse -Force .\packages\cron\.git" -ForegroundColor White
    Write-Host ""
    Write-Host "  # Initialize new monorepo" -ForegroundColor Gray
    Write-Host "  git init" -ForegroundColor White
    Write-Host "  git add ." -ForegroundColor White
    Write-Host "  git commit -m 'feat: migrate to monorepo structure'" -ForegroundColor White
    Write-Host "  git remote add origin <your-new-repo-url>" -ForegroundColor White
    Write-Host "  git push -u origin main" -ForegroundColor White
    Write-Host ""
}

Write-Host "`n✅ Migration Complete!" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Cyan
Write-Host "  1. Review moved files in packages/liga-admin and packages/cron"
Write-Host "  2. Remove old .git folders from packages if they exist"
Write-Host "  3. Initialize new monorepo with: git init"
Write-Host "  4. Update any absolute paths in your code"
Write-Host "  5. Test both packages:"
Write-Host "     cd packages/liga-admin && npm run dev"
Write-Host "     cd packages/cron && python cron_clash_sync.py"
Write-Host ""
