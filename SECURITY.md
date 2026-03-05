# Security Policy

## Credentials & Secrets Management

### ⚠️ CRITICAL RULES

1. **NEVER commit credentials to Git** - Under any circumstances
2. **NEVER hardcode secrets** in source code files
3. **ALWAYS use `.gitignore`** for sensitive files
4. **ALWAYS use environment variables** in CI/CD and production

### Files That Must Never Be Committed

- `.vscode/mcp.json` - Supabase credentials
- `.env` files - Environment-specific secrets
- `.vscode/settings.json` - Personal IDE settings
- Any file containing API keys, tokens, or passwords

These are protected by `.gitignore` - verify before any commit.

## Incident Response

If credentials are accidentally exposed:

### 1. Immediate Actions (First 5 minutes)
- [ ] Revoke the exposed token in the cloud provider (Supabase, AWS, etc.)
- [ ] Generate a replacement token
- [ ] Alert the security team immediately

### 2. Git History Cleanup (Within 1 hour)
- [ ] Use BFG Repo-Cleaner to remove from git history
- [ ] Force push to remote repository
- [ ] Notify all team members to re-clone and update credentials

### 3. Post-Incident (Within 24 hours)
- [ ] Audit logs for unauthorized access
- [ ] Review what permissions were exposed
- [ ] Document the incident for compliance
- [ ] Update security training if needed

## Setup Instructions

See [.vscode/CREDENTIALS_SETUP.md](.vscode/CREDENTIALS_SETUP.md) for detailed setup instructions.

Quick start:
```bash
cp .vscode/mcp.json.example .vscode/mcp.json
# Edit .vscode/mcp.json and add your token
```

## Pre-Commit Checklist

Before committing code:

```bash
# Check for accidentally staged sensitive files
git status

# Search for common credential patterns
git diff --cached | grep -iE "password|secret|token|key|api_key|sbp_"

# Verify .gitignore is protecting sensitive files
cat .gitignore | grep -E "\.env|mcp\.json|secrets"
```

## Team Responsibilities

- **Developers**: Follow credentials setup guide, never commit secrets
- **Code Reviewers**: Check diffs for hardcoded credentials during PR review
- **DevOps/Security**: Monitor git history, set up pre-commit hooks
- **Project Lead**: Ensure all team members understand this policy

## Automated Prevention

We recommend setting up pre-commit hooks to prevent credential commits:

```bash
# Install pre-commit framework
pip install pre-commit

# Initialize hooks (if not already done)
pre-commit install

# Manually run hooks on all files
pre-commit run --all-files
```

Pre-commit hooks can check for:
- Hardcoded credentials patterns
- `.env` files
- AWS/Azure/GCP credentials
- Private keys

## Reporting Security Issues

If you discover a security vulnerability:

1. **DO NOT** create a public GitHub issue
2. **DO** email security concerns directly to the project maintainers
3. **DO** include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if you have one)

## References

- [OWASP - Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [Git - Removing Sensitive Data](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)
- [BFG Repo-Cleaner](https://rtyley.github.io/bfg-repo-cleaner/)
- [Pre-commit Framework](https://pre-commit.com/)

---

**Last Updated**: 2025-01-31  
**Status**: Active - All team members should review
