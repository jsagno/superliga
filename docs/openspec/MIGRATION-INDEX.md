# OpenSpec Migration Index

**Date**: February 2026  
**Status**: ✅ Complete

This document tracks the migration of legacy documentation from `specs/` to the new OpenSpec structure.

## Migration Mapping

| Original File | New Location | Type | Status |
|--------------|--------------|------|--------|
| `specs/admin-dashboard.md` | `features/liga-admin/admin-dashboard.md` | Feature Index | ✅ Migrated |
| `specs/clash-sync-cron.md` | `features/cron/battle-sync.md` | Feature Index | ✅ Migrated |
| `specs/data-models.md` | `architecture/data-model.md` | Architecture | ✅ Migrated |
| `specs/cron-technical-architecture.md` | `architecture/cron-technical-spec.md` | Architecture | ✅ Migrated |
| `specs/liga-admin-technical-architecture.md` | `architecture/liga-admin-technical-spec.md` | Architecture | ✅ Migrated |
| `specs/git-workflow.md` | `specs/git-workflow.md` | Process | ℹ️ Kept in place |

## Directory Structure After Migration

```
docs/openspec/
├── products/
│   ├── cron.md                    # Product definition (populated)
│   └── liga-admin.md              # Product definition (populated)
├── features/
│   ├── cron/
│   │   ├── battle-sync.md         # ← specs/clash-sync-cron.md (index)
│   │   ├── api-ingestion.md
│   │   ├── data-synchronization.md
│   │   ├── historical-tracking.md
│   │   ├── error-handling.md
│   │   ├── performance.md
│   │   └── sync-operations.md
│   └── liga-admin/
│       ├── admin-dashboard.md     # ← specs/admin-dashboard.md (index)
│       ├── player-rankings.md
│       ├── clan-overview.md
│       ├── player-profiles.md
│       ├── search-filter.md
│       ├── data-currency-indicator.md
│       ├── war-dashboard.md
│       ├── responsive-design.md
│       └── dashboard-nonfunctional.md
├── business-rules/
│   ├── tournament-rules.md        # (populated)
│   ├── deck-validation.md         # (populated)
│   ├── scoring-system.md          # (populated)
│   └── player-eligibility.md      # (populated)
├── architecture/
│   ├── system-overview.md         # (placeholder)
│   ├── data-model.md              # ← specs/data-models.md
│   ├── cron-technical-spec.md     # ← specs/cron-technical-architecture.md
│   └── liga-admin-technical-spec.md  # ← specs/liga-admin-technical-architecture.md
└── specs/
    └── git-workflow.md            # (kept, process documentation)
```

## Next Steps

### 1. Populate Product Definitions
- [x] `products/cron.md` - Define cron product purpose, capabilities, tech stack
- [x] `products/liga-admin.md` - Define liga-admin product purpose, features, tech stack

### 2. Extract Business Rules
Review migrated content and extract business logic to `business-rules/`:
- [x] `tournament-rules.md` - Tournament structure, phases, schedules
- [x] `deck-validation.md` - Card restrictions, deck composition rules
- [x] `scoring-system.md` - Point calculations, ranking algorithms
- [x] `player-eligibility.md` - Participation requirements, account linking

### 3. Break Down Features
Review monolithic feature docs and split into discrete features:

**From `admin-dashboard.md`:**
- [x] `features/liga-admin/player-rankings.md` (REQ-1, REQ-4)
- [x] `features/liga-admin/clan-overview.md` (REQ-2)
- [x] `features/liga-admin/player-profiles.md` (REQ-3)
- [x] `features/liga-admin/war-dashboard.md` (REQ-6)
- [x] `features/liga-admin/data-currency-indicator.md` (REQ-5)
- [x] `features/liga-admin/search-filter.md` (REQ-4)
- [x] `features/liga-admin/responsive-design.md` (REQ-7)
- [x] `features/liga-admin/dashboard-nonfunctional.md` (UI/Performance)

**From `battle-sync.md`:**
- [x] `features/cron/api-ingestion.md` (REQ-1)
- [x] `features/cron/data-synchronization.md` (REQ-2)
- [x] `features/cron/historical-tracking.md` (REQ-3)
- [x] `features/cron/error-handling.md` (REQ-4)
- [x] `features/cron/performance.md` (REQ-5)
- [x] `features/cron/sync-operations.md` (implementation guidance)

### 4. Consolidate Architecture
- [ ] Review `architecture/cron-technical-spec.md` (706 lines)
- [ ] Review `architecture/liga-admin-technical-spec.md`
- [ ] Merge common patterns into `system-overview.md`
- [x] Keep product-specific details in `products/` definitions

### 5. Process Documentation
- [ ] Decide final location for `git-workflow.md` (keep in specs/ or move to root docs/)
- [ ] Consider creating `docs/contributing/` for contributor guides

## Migration Notes

**Preserved Content**: All original files remain in `specs/` until verification is complete.

**Placeholder Files**: Empty placeholder files created during scaffolding can be deleted once populated with actual content.

**Path Updates**: Agent prompts in `.github/agents/` have been updated to reference new paths in `docs/openspec/`.

**Monorepo Context**: This migration is part of the larger monorepo consolidation where `liga-admin` and `cron` were moved to `packages/` directory.

## Validation Checklist

- [x] All spec files copied to new locations
- [x] File naming follows OpenSpec conventions (kebab-case)
- [x] Directory structure matches OpenSpec design
- [x] Agent prompts reference correct paths
- [x] Content reviewed and organized by feature
- [x] Business rules extracted from feature specs
- [x] Product definitions populated
- [ ] Architecture docs consolidated
- [ ] Original `specs/` directory archived or removed
