# PR Preparation Pack (2026-03-15)

This folder contains ready-to-use pull request drafts for all currently identified pending work without PR coverage.

## Current Pending Without PR

1. Branch: feature/liga-jugador-standings
- Status: Ahead of main by 1 commit
- PR: Missing
- Draft file: PR_liga-jugador-standings.md

2. Issue #4: Playwright login helper redirect timeout
- Status: Open issue with no open PR
- Existing branch: fix/test-infrastructure-issue-4 (contains extra historical commits)
- Recommended PR branch: fix/issue-4-login-helper-timeout (clean branch from main, cherry-pick 9a9a967)
- Draft file: PR_issue-4-playwright-login-timeout.md

## Recommended Execution Order

1. Open PR for liga-jugador feature branch.
2. Create clean branch for issue #4 from main and open PR.
3. Link both PRs to corresponding OpenSpec change/issue.
4. Close or archive outdated extra branches after merge.

## Quick Commands

For liga-jugador PR:
- git checkout feature/liga-jugador-standings
- git push origin feature/liga-jugador-standings

For issue #4 clean PR:
- git checkout main
- git pull origin main
- git checkout -b fix/issue-4-login-helper-timeout
- git cherry-pick 9a9a967
- git push -u origin fix/issue-4-login-helper-timeout

If using GitHub CLI:
- gh pr create --base main --head feature/liga-jugador-standings --title "feat(liga-jugador): implement player portal core and standings" --body-file docs/pr-prep/PR_liga-jugador-standings.md
- gh pr create --base main --head fix/issue-4-login-helper-timeout --title "fix(tests): stabilize Playwright admin login redirect handling" --body-file docs/pr-prep/PR_issue-4-playwright-login-timeout.md

Note: If gh is not authenticated, run gh auth login first.
