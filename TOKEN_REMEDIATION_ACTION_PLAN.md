# 🔴 CRITICAL: Token Exposure Remediation Action Plan

**Status**: URGENT - Exposed Supabase token on GitHub  
**Date Discovered**: 2025-01-31  
**Exposed Token**: `sbp_eaacd0aeeddd8990d6396cd78bcd2906b54b9166`  
**GitHub Commit**: `17ac1c2a025e0eea26a0a8c1d5e1973f9d79ef92`  
**Repository**: https://github.com/jsagno/superliga

---

## Phase 1: Emergency Containment (DO IMMEDIATELY - 5-10 minutes)

### Step 1.1: Revoke the Exposed Token
- [ ] Go to https://app.supabase.com
- [ ] Sign in to your Supabase project
- [ ] Navigate to: **Project Settings → Access Tokens**
- [ ] Find token: `sbp_eaacd0aeeddd8990d6396cd78bcd2906b54b9166`
- [ ] Click **Revoke** (or delete)
- [ ] **Status**: This token is now INVALID

**Why**: Even if it's revoked, it's still visible in git history. We'll clean that next.

---

## Phase 2: Git History Cleanup (DO NEXT - 20-30 minutes)

### Step 2.1: Remove from Git History (Choose ONE method)

#### **Method A: BFG Repo-Cleaner (RECOMMENDED - Fastest)**

```bash
# 1. Install BFG (if you don't have it)
# Windows: choco install bfg
# macOS: brew install bfg
# Linux: apt install bfg

# 2. Create a file with the token to remove
echo "sbp_eaacd0aeeddd8990d6396cd78bcd2906b54b9166" > /tmp/secrets.txt

# 3. Navigate to the repo
cd d:\LigaInterna

# 4. Run BFG to clean the token from all history
bfg --replace-text /tmp/secrets.txt

# 5. Clean up git internals
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# 6. Push to remote (FORCE PUSH - this overwrites history)
git push --force origin main
```

#### **Method B: Git Filter Repo (Alternative)**

```bash
# 1. Install git-filter-repo
pip install git-filter-repo

# 2. Navigate to the repo
cd d:\LigaInterna

# 3. Remove the token from all history
git filter-repo --path .vscode/mcp.json --path-glob "*.json" \
  --invert-paths --force

# 4. Push remote
git push --force origin main
```

#### **Method C: Interactive Rebase (Manual - Only if other methods fail)**

```bash
# Find the commit with the token
git log --all --oneline | head -20

# Rebase from before that commit
git rebase -i <commit-id>~1

# In the editor: change 'pick' to 'drop' for the token commit
# Save and exit

# Push (FORCE PUSH)
git push --force origin main
```

### Step 2.2: Verify Token is Gone

```bash
# Search entire git history for the token
git log --all -p | grep -i "sbp_eaacd0aeeddd8990d6396cd78bcd2906b54b9166"

# Should output: (no results)
# If you still see the token, repeat Step 2.1
```

---

## Phase 3: Team Notification (DO AFTER Git Cleanup - 15-20 minutes)

### Step 3.1: Notify Team

Send this message to your team via **secure channel** (1Password, Slack Enterprise Grid, or direct message):

---

**Subject: 🔴 CRITICAL - Supabase Token Exposure & Remediation**

Team,

A Supabase access token was accidentally exposed in a Git commit on GitHub. We've taken immediate action:

**What Happened:**
- Token `sbp_eaacd0a...` was committed in `.vscode/mcp.json`
- It was visible in public GitHub history
- We've now revoked the token and cleaned git history

**Actions Taken:**
1. ✅ Token revoked in Supabase dashboard
2. ✅ Local `.vscode/mcp.json` updated to use environment variables
3. ✅ Git history cleaned (token removed from all commits)
4. ✅ `.vscode/mcp.json.example` created as template

**What You Need To Do:**
1. Pull latest changes: `git pull origin main`
2. Follow credentials setup: See `.vscode/CREDENTIALS_SETUP.md`
3. Get NEW Supabase token from project maintainer (NOT from git)
4. Update your local `.vscode/mcp.json` with new token
5. Test that your setup works

**DO NOT:**
- Use the old token (it's been revoked)
- Commit `.vscode/mcp.json` to Git
- Share your token via chat/email - keep it locally only

**Questions?** Contact [Project Lead] immediately.

---

### Step 3.2: Generate & Share New Token

```bash
# For yourself:
# 1. Go to Supabase dashboard → Access Tokens
# 2. Create a new personal access token
# 3. Copy it to your local .vscode/mcp.json

# For team (secure distribution):
# - Use 1Password, Vault, or secure password manager
# - Send individual links, not shared links
# - Include expiration date (recommend: 90 days)
# - Document which token is for which person/purpose
```

---

## Phase 4: Verification & Documentation (20-30 minutes)

### Step 4.1: Verify Everything Works Locally

```bash
# 1. Confirm git history is clean
git log --oneline --all | grep -E "mcp|secret|token|cred"
# Should show: no matches

# 2. Verify .vscode/mcp.json is present but not staged
git status
# Should show: .vscode/mcp.json NOT in unstaged changes

# 3. Test Supabase connection with new token
# (This depends on your application - adjust as needed)
npm run dev  # or python cron_clash_sync.py, etc.
```

### Step 4.2: Update Team Documentation

- [ ] Add link to `SECURITY.md` in main README
- [ ] Add link to `.vscode/CREDENTIALS_SETUP.md` in setup instructions
- [ ] Update new dev onboarding checklist
- [ ] Document this incident in `docs/openspec/changelog.md`:

```markdown
### Security Update - Token Exposure Remediation
- **Date**: 2025-01-31
- **Issue**: Supabase token exposed in `.vscode/mcp.json` on GitHub
- **Resolution**: Token revoked, git history cleaned, team notified
- **Ref**: SECURITY.md, .vscode/CREDENTIALS_SETUP.md
```

### Step 4.3: Set Up Preventive Measures

#### Pre-commit Hook (Optional but Recommended)

```bash
# Create .git/hooks/pre-commit
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
# Prevent commits of credentials

CREDENTIALS_PATTERNS=(
  "sbp_"
  "SUPABASE_ACCESS_TOKEN"
  "aws_secret"
  "private_key"
  "password"
)

for pattern in "${CREDENTIALS_PATTERNS[@]}"; do
  if git diff --cached | grep -i "$pattern"; then
    echo "❌ ERROR: Found potential credential: $pattern"
    echo "Please remove before committing"
    exit 1
  fi
done
exit 0
EOF

chmod +x .git/hooks/pre-commit
```

---

## Checklist Summary

### Immediate (5-10 min)
- [ ] Revoke exposed token in Supabase dashboard
- [ ] Verify token is now invalid

### Git History (20-30 min)
- [ ] Remove token from git history (BFG or filter-repo)
- [ ] Force push to GitHub
- [ ] Verify token no longer in history

### Team Communication (15-20 min)
- [ ] Notify team via secure channel
- [ ] Generate and distribute new token securely
- [ ] Provide setup instructions

### Verification (20-30 min)
- [ ] Test local setup with new token
- [ ] Verify git history is clean
- [ ] Update documentation
- [ ] Document incident

### Prevention (Optional - 15 min)
- [ ] Set up pre-commit hooks
- [ ] Review `.gitignore` is comprehensive
- [ ] Plan security training

---

## Timeline

- **T+0-10 min**: Token revoked, immediate containment ✅ (completed)
- **T+10-40 min**: Git history cleaned, team notified
- **T+40-70 min**: Verification, documentation, prevention setup
- **T+70+ min**: Monitor for any issues

---

## If Something Goes Wrong

### Issue: Force Push Rejection
```bash
# If GitHub prevents force push, you may need to:
# 1. Contact repo admin to enable force push
# 2. Use git push --force-with-lease (safer)
# 3. As last resort: recreate branch without sensitive commit
```

### Issue: Team Can't Update
- Provide direct download link to new token via secure channel
- Update `.vscode/mcp.json.example` with detailed instructions
- Screen share setup process with team members

### Issue: Token Still Visible After Cleanup
```bash
# Token might be cached by GitHub
# Give GitHub 5-10 minutes to refresh
# If still visible: check commit SHAs haven't changed
git rev-parse HEAD  # Should show different SHA after cleanup
```

---

## References

- [Removing Sensitive Data from Git](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)
- [BFG Repo-Cleaner](https://rtyley.github.io/bfg-repo-cleaner/)
- [Git Filter Repo](https://github.com/newren/git-filter-repo)
- [Supabase Access Tokens](https://supabase.com/docs/admins/managing-projects/security/authentication)

---

**Status After Completion**: ✅ Secure  
**Next Steps**: Resume feature implementation (Phase 5 of daily-points-round-grouping-penalties)
