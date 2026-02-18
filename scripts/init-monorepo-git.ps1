# Git repository reset and initialization for monorepo
# Run from LigaInterna root directory

Write-Host "🔧 Git Repository Reset for Monorepo" -ForegroundColor Cyan
Write-Host "====================================`n" -ForegroundColor Cyan

# Step 1: Backup current git history (optional)
Write-Host "📦 Step 1: Backing up current git state..." -ForegroundColor Yellow
if (Test-Path ".\.git") {
    $backupPath = ".\.git-backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    Write-Host "  Creating backup at: $backupPath"
    Copy-Item -Path ".\.git" -Destination $backupPath -Recurse -Force
    Write-Host "  ✓ Backup created" -ForegroundColor Green
} else {
    Write-Host "  ⚠ No .git folder found, skipping backup" -ForegroundColor Yellow
}

# Step 2: Remove old git folder
Write-Host "`n🗑️  Step 2: Removing old git repository..." -ForegroundColor Yellow
if (Test-Path ".\.git") {
    Remove-Item -Path ".\.git" -Recurse -Force
    Write-Host "  ✓ Old .git folder removed" -ForegroundColor Green
} else {
    Write-Host "  ⚠ No .git folder to remove" -ForegroundColor Yellow
}

# Step 3: Remove any git folders from packages
Write-Host "`n🧹 Step 3: Cleaning git folders from packages..." -ForegroundColor Yellow
$packageGitFolders = @(
    ".\packages\liga-admin\.git",
    ".\packages\cron\.git"
)

foreach ($gitPath in $packageGitFolders) {
    if (Test-Path $gitPath) {
        Write-Host "  Removing: $gitPath"
        Remove-Item -Path $gitPath -Recurse -Force
        Write-Host "  ✓ Removed" -ForegroundColor Green
    }
}

# Step 4: Initialize new git repository
Write-Host "`n🆕 Step 4: Initializing new monorepo..." -ForegroundColor Yellow
git init
Write-Host "  ✓ Git initialized" -ForegroundColor Green

# Step 5: Set default branch to main
Write-Host "`n🌿 Step 5: Setting default branch to main..." -ForegroundColor Yellow
git branch -M main
Write-Host "  ✓ Branch set to main" -ForegroundColor Green

# Step 6: Add all files
Write-Host "`n📁 Step 6: Adding all files..." -ForegroundColor Yellow
git add .
Write-Host "  ✓ Files staged" -ForegroundColor Green

# Step 7: Show status
Write-Host "`n📊 Step 7: Repository status..." -ForegroundColor Yellow
$status = git status --short
if ($status) {
    Write-Host "  Files to commit:"
    $status | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }
} else {
    Write-Host "  No files to commit" -ForegroundColor Yellow
}

# Step 8: Commit
Write-Host "`n💾 Step 8: Creating initial commit..." -ForegroundColor Yellow
git commit -m "feat: migrate to monorepo structure

- Consolidated liga-admin and cron into packages/
- Centralized documentation in docs/openspec/
- Added shared database resources
- Created monorepo README and structure
- Added Developer and ProductManager agents"

Write-Host "  ✓ Initial commit created" -ForegroundColor Green

# Step 9: Instructions for remote
Write-Host "`n🌐 Next Steps: Connect to Remote Repository" -ForegroundColor Cyan
Write-Host "==========================================`n" -ForegroundColor Cyan

Write-Host "Option 1: Create a new GitHub repository" -ForegroundColor Yellow
Write-Host "  1. Go to https://github.com/new"
Write-Host "  2. Create a new repository (e.g., 'LigaInterna')"
Write-Host "  3. Run these commands:"
Write-Host ""
Write-Host "     git remote add origin https://github.com/yourusername/LigaInterna.git" -ForegroundColor White
Write-Host "     git push -u origin main" -ForegroundColor White
Write-Host ""

Write-Host "Option 2: Use an existing repository" -ForegroundColor Yellow
Write-Host "  Run these commands:"
Write-Host ""
Write-Host "     git remote add origin <your-repo-url>" -ForegroundColor White
Write-Host "     git push -u origin main --force" -ForegroundColor White
Write-Host "     # Note: --force will overwrite remote history" -ForegroundColor Gray
Write-Host ""

Write-Host "✅ Monorepo Git Setup Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Your repository structure:" -ForegroundColor Cyan
Write-Host "  📁 packages/" -ForegroundColor White
Write-Host "    ├── liga-admin/  (React 19 dashboard)"
Write-Host "    └── cron/         (Python sync service)"
Write-Host "  📚 docs/" -ForegroundColor White
Write-Host "    └── openspec/    (Product specifications)"
Write-Host "  🗄️  shared/" -ForegroundColor White
Write-Host "    └── database/    (Schema and migrations)"
Write-Host "  🤖 .github/agents/ (AI agent prompts)" -ForegroundColor White
Write-Host ""
