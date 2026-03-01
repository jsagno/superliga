#!/bin/bash
# PRE-PUSH HOOK: Enforce Playwright tests for UI changes
#
# Installation:
#   bash scripts/install-git-hooks.sh
#   OR manually:
#   cp scripts/pre-push-hook.sh .git/hooks/pre-push
#   chmod +x .git/hooks/pre-push
#
# How it works:
#   Prevents push if UI components/pages changed without corresponding E2E tests
#   Compares current branch against the remote branch being pushed to
#   Runs automatically before git push

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;36m'
NC='\033[0m' # No Color

# Check if we should skip this hook
if [ "$SKIP_PRE_PUSH_HOOK" = "1" ]; then
  echo -e "${YELLOW}⚠️  Skipping pre-push hook (SKIP_PRE_PUSH_HOOK=1)${NC}"
  exit 0
fi

# Read stdin for remote and branch info
# Format: <local ref> <local sha> <remote ref> <remote sha>
while read local_ref local_sha remote_ref remote_sha
do
  # Skip if deleting a branch
  if [ "$local_sha" = "0000000000000000000000000000000000000000" ]; then
    continue
  fi
  
  # Determine the base commit to compare against
  if [ "$remote_sha" = "0000000000000000000000000000000000000000" ]; then
    # New branch, compare against main/master
    if git rev-parse --verify origin/main >/dev/null 2>&1; then
      base="origin/main"
    elif git rev-parse --verify origin/master >/dev/null 2>&1; then
      base="origin/master"
    else
      echo -e "${YELLOW}⚠️  No main/master branch found, skipping UI test enforcement${NC}"
      exit 0
    fi
  else
    # Existing branch, compare against remote version
    base="$remote_sha"
  fi
  
  echo -e "${BLUE}🔍 Checking UI changes for Playwright test coverage...${NC}"
  
  # Navigate to liga-admin package
  cd "$(git rev-parse --show-toplevel)/packages/liga-admin" 2>/dev/null || {
    echo -e "${YELLOW}⚠️  liga-admin package not found, skipping UI test enforcement${NC}"
    exit 0
  }
  
  # Check if node is available
  if ! command -v node >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Node.js not found, skipping UI test enforcement${NC}"
    exit 0
  fi
  
  # Check if enforcement script exists
  if [ ! -f "tools/enforce-playwright-for-ui-changes.cjs" ]; then
    echo -e "${YELLOW}⚠️  Enforcement script not found, skipping UI test enforcement${NC}"
    exit 0
  fi
  
  # Run the enforcement check
  if node tools/enforce-playwright-for-ui-changes.cjs --base="$base" 2>&1; then
    echo -e "${GREEN}✅ UI test coverage check passed${NC}"
  else
    echo -e "${RED}❌ Pre-push hook failed: UI changes require Playwright tests${NC}"
    echo -e "${YELLOW}To bypass this check (not recommended):${NC}"
    echo -e "  SKIP_PRE_PUSH_HOOK=1 git push"
    echo -e "${YELLOW}Or fix the issue by adding E2E tests in tests/e2e/${NC}"
    exit 1
  fi
done

exit 0
