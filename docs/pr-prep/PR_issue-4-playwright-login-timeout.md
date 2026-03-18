Closes #4

## Summary

Fixes Playwright login helper instability caused by redirect timing race after successful admin sign-in.

## Why

Issue #4 is open and blocks reliable automated E2E execution for auth-dependent tests. No PR is currently open for this issue.

## Branch Strategy

Use a clean branch from main and cherry-pick only commit 9a9a967:
- Source branch with mixed history: fix/test-infrastructure-issue-4
- Clean target branch: fix/issue-4-login-helper-timeout
- Cherry-pick commit: 9a9a967

This prevents re-introducing already merged historical commits into the PR diff.

## Scope

Changes expected from commit 9a9a967:
- packages/liga-admin/tests/e2e/helpers.js
- packages/liga-admin/tests/e2e/battles-history-zone-filter.spec.js

## Expected Behavior After Fix

- Login helper no longer times out waiting for post-login navigation.
- Authenticated E2E scenarios proceed consistently.
- Battles history zone filter E2E flow remains stable.

## Verification Plan

1. Run affected Playwright specs in liga-admin.
2. Confirm login helper succeeds repeatedly (multiple runs).
3. Capture evidence for:
- Primary flow: login + battles history path.
- Adjacent regression flow: another authenticated admin page.

## Suggested Test Commands

- cd packages/liga-admin
- npm run test:e2e -- tests/e2e/battles-history-zone-filter.spec.js
- npm run test:e2e -- tests/e2e/battles-history.spec.js

## Checklist

- [ ] PR is based on clean branch from main
- [ ] Only issue #4 related files are included
- [ ] E2E evidence attached for primary and adjacent regression flows
- [ ] Issue #4 linked and auto-closing enabled
- [ ] No unrelated config or dependency drift
