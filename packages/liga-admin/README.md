# LIGA-ADMIN - Tournament Management Dashboard

React 19 admin interface for managing competitive seasons.

## Quick Start

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your Supabase credentials

# Start dev server
npm run dev
```

## Documentation

- **Product Spec**: [../../docs/openspec/products/liga-admin.md](../../docs/openspec/products/liga-admin.md)
- **Features**: [../../docs/openspec/features/liga-admin/](../../docs/openspec/features/liga-admin/)
- **Architecture**: [../../docs/openspec/architecture/system-overview.md](../../docs/openspec/architecture/system-overview.md)

## Daily Points (Season View)

- Daily points are grouped by rounds using `season.days_per_round` (default `4`).
- Consecutive misses apply penalties per scheduled date: `-1`, `-2`, `-5`, `-10` (4th+).
- Players are excluded from the grid after 4 consecutive misses.

## Testing

### Unit Tests

Unit tests use Vitest for testing business logic and utilities.

```bash
# Run all unit tests
npm run test

# Run specific test file (e.g., daily points)
npm run test:unit

# Watch mode
npm run test -- --watch
```

### E2E Tests

End-to-end tests use Playwright to test user flows.

```bash
# Run E2E tests (headless)
npm run test:e2e

# Run with UI for debugging
npm run test:e2e:ui

# Test against production build
npm run test:e2e:serve
```

### UI Testing Enforcement

**Policy**: All UI component/page changes MUST have corresponding Playwright E2E tests.

```bash
# Check if UI changes have tests (runs in pre-push hook)
npm run check:ui-e2e

# Manual check against a specific commit
npm run check:ui-e2e -- --base=main
```

**Enforcement**:
- ✅ Automated via `pre-push` git hook
- ❌ Push blocked if UI changes lack E2E test coverage
- 🔄 Checks files in `src/components/` and `src/pages/`
- 📝 Requires matching tests in `tests/e2e/*.spec.js`

**Bypass** (not recommended):
```bash
SKIP_PRE_PUSH_HOOK=1 git push
```

**Installation**:
```bash
# Install git hooks (from repository root)
bash scripts/install-git-hooks.sh
```

## Environment Variables

```env
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```
