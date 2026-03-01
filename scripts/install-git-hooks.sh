#!/bin/bash
# Install Git Hooks for LigaInterna
# This script installs all required git hooks for the project

set -e

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}📦 Installing Git Hooks for LigaInterna...${NC}"

# Get the repository root
REPO_ROOT="$(git rev-parse --show-toplevel)"
HOOKS_DIR="$REPO_ROOT/.git/hooks"
SCRIPTS_DIR="$REPO_ROOT/scripts"

# Ensure hooks directory exists
mkdir -p "$HOOKS_DIR"

# Install pre-push hook (Playwright enforcement)
echo -e "${BLUE}Installing pre-push hook (UI test enforcement)...${NC}"
if [ -f "$SCRIPTS_DIR/pre-push-hook.sh" ]; then
  cp "$SCRIPTS_DIR/pre-push-hook.sh" "$HOOKS_DIR/pre-push"
  chmod +x "$HOOKS_DIR/pre-push"
  echo -e "${GREEN}✅ pre-push hook installed${NC}"
else
  echo -e "${YELLOW}⚠️  pre-push-hook.sh not found in scripts directory${NC}"
fi

# Note: pre-commit hook (credential check) should already exist
if [ -f "$HOOKS_DIR/pre-commit" ]; then
  echo -e "${GREEN}✅ pre-commit hook already installed${NC}"
else
  echo -e "${YELLOW}⚠️  pre-commit hook not found${NC}"
fi

echo ""
echo -e "${GREEN}✅ Git hooks installation complete!${NC}"
echo ""
echo -e "${BLUE}Installed hooks:${NC}"
echo -e "  • pre-commit: Prevents credential leaks"
echo -e "  • pre-push: Enforces Playwright tests for UI changes"
echo ""
echo -e "${YELLOW}To bypass hooks (not recommended):${NC}"
echo -e "  SKIP_PRE_COMMIT_HOOK=1 git commit"
echo -e "  SKIP_PRE_PUSH_HOOK=1 git push"
