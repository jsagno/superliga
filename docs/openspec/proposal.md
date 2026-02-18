# Centralized OpenSpec Documentation Proposal

## Problem Statement

Currently, the Liga Interna project has two separate components:
1. **Liga-admin** (React frontend) - Displays clan & player data
2. **Cron** (Python backend) - Syncs data from Clash API to Supabase

**Issues:**
- No shared specification defining data models, sync behavior, or UI requirements
- Changes to one project without visibility to the other cause breaking changes
- AI agents lack a centralized source of truth for understanding the system
- Manual coordination required for feature updates across both projects
- New developers struggle to understand system design and dependencies

## Proposed Solution: OpenSpec-Driven Development

Implement **OpenSpec** as the single source of truth for:
- **What data** flows through the system (data models)
- **How data** gets synchronized (cron requirements)
- **How users** interact with data (frontend specifications)
- **System architecture** and tech decisions

## Vision

Create an **agent-friendly specification layer** that enables:
- ✅ **Unified Planning**: Both projects follow same specs before any code
- ✅ **AI Agent Support**: Agents read specs to understand context & constraints
- ✅ **Change Transparency**: Each update documents what changed and why
- ✅ **Multi-repo Coordination**: Liga-admin and cron stay synchronized
- ✅ **Knowledge Base**: New developers understand system in minutes, not days

## OpenSpec Structure

```
LigaInterna/openspec/
├── specs/
│   ├── data-models.md           # Shared entity definitions
│   ├── clash-sync-cron.md       # Sync job requirements
│   ├── admin-dashboard.md       # Frontend requirements
│   └── ...other features
├── design.md                     # System architecture & tech decisions
├── proposal.md                   # This document
├── tasks.md                      # Implementation checklist
└── changes/                      # Track feature changes (future)
```

## Key Specifications Created

### 1. Data Models (`specs/data-models.md`)
Defines shared entities used by both projects:
- **Player**: Supercell player stats, clan membership
- **Clan**: Clan statistics, metadata
- **Battle**: Individual battle records with outcomes
- **PlayerSnapshot**: Historical player data for trend analysis
- **War**: War records with participants and results

**Benefits:**
- Frontend and cron know exact field names and types
- Validation rules prevent bad data
- TypeScript/Python models can be auto-generated from spec

### 2. Clash Sync Cron (`specs/clash-sync-cron.md`)
Defines how data flows from Clash API → Supabase:
- Fetch frequency and rate limiting
- Error handling and retries
- Cache strategy and TTL
- Batch processing and performance targets
- Monitoring and alerting

**Benefits:**
- Cron maintainers understand performance expectations
- Frontend knows data freshness SLAs
- Agents can implement robustly without guessing

### 3. Admin Dashboard (`specs/admin-dashboard.md`)
Defines frontend UI/UX requirements:
- Player rankings and search
- War dashboard and real-time updates
- Profile views with charts
- Responsive design (mobile/tablet/desktop)
- Data refresh strategy

**Benefits:**
- Clear feature scope prevents scope creep
- Designers and developers align on layouts
- Accessibility standards documented
- Performance targets defined upfront

### 4. System Design (`design.md`)
Defines overall architecture:
- Component interactions and data flow
- Database schema and indexes
- API endpoints (Supabase PostgREST)
- Deployment strategy
- Monitoring and observability
- Scalability roadmap

**Benefits:**
- New developers understand "big picture"
- Architecture decisions documented (why we chose Supabase, not Firebase)
- Scalability constraints known upfront
- Deployment responsibilities clear

## How AI Agents Use This

### Before Implementation
```
Agent: "How should I implement player rankings?"
Dev: "Check /openspec/specs/admin-dashboard.md - REQ-1"
Agent: [reads spec, understands all requirements]
Agent: "I'll implement sorting by trophies, filtering by role, and add win rate..."
```

### During Implementation
```
Agent: "What data fields does Player have?"
Dev: "Check /openspec/specs/data-models.md - Player interface"
Agent: [sees TypeScript interface, validates frontend code matches]
```

### After Implementation
```
Agent: "I updated battle retry logic from 3 to 5 attempts"
Dev: [reads change summary in OpenSpec changes log]
Dev: [confirms this aligns with REQ-4 in clash-sync-cron.md]
```

## Implementation Steps (Next Phase)

1. **Agents Read & Reference**
   - Prompt: `Read /openspec/specs/data-models.md and implement Player entity`
   - Agents cite spec requirements in code comments

2. **Version Control Specs**
   - Commit spec changes alongside code
   - Use diff to review what requirements changed

3. **Generate Code from Specs** (Advanced)
   - Auto-generate TypeScript interfaces from data-models.md
   - Auto-generate validation schemas for Supabase RLS policies
   - Auto-generate API client code for frontend

4. **Maintain Living Docs**
   - Update specs as requirements evolve
   - Never let code and specs drift
   - Use spec deltas as PR description

## Benefits Summary

| Benefit | How It Helps | Who Benefits |
|---------|-------------|---|
| **Single Source of Truth** | No ambiguity about data models or behavior | Developers, Agents, Teams |
| **Agent Context** | AI agents read specs instead of guessing | Agents, Code Quality |
| **Cross-Project Sync** | Liga-admin and cron stay coordinated | Developers, Users |
| **Onboarding** | New developers understand system in minutes | New Team Members |
| **Change Tracking** | Delta format shows what changed and why | Leads, Code Reviewers |
| **Requirements Clarity** | Explicit scenarios and validation rules | QA, Testers, Developers |
| **Performance SLAs** | Upfront targets (cache TTL, query latency) | Ops, Users |
| **Scalability Roadmap** | MVP vs Future architecture defined | Leads, Designers |

## Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Specs become stale | Useless if not maintained | Commit discipline: specs = code |
| Specs are too detailed | Hard to keep updated | Balance detail with brevity |
| Specs have errors | Agents implement wrong thing | Review cycle before dev |
| Team resists docs | No adoption | Show value in 1 feature first |

## Success Metrics

- ✅ Agents reference specs in 100% of new features
- ✅ Zero breaking changes between projects (specs prevent this)
- ✅ Onboarding time reduced from 2 weeks to 2 days
- ✅ Specs stay <2 weeks stale
- ✅ Feature delta captures 90%+ of change intent

## Next Steps

1. **Now**: Create core specs (data models, sync, UI) ✅
2. **Week 1**: Agents implement Player model per spec
3. **Week 2**: Agents implement battle sync per spec
4. **Week 3**: Review & refine specs based on learnings
5. **Ongoing**: Maintain specs as living document

## Related Documentation

- See `design.md` for system architecture details
- See `specs/data-models.md` for entity definitions
- See `specs/clash-sync-cron.md` for sync requirements
- See `specs/admin-dashboard.md` for UI specifications

---

**Created**: 2025-02-17
**Status**: Approved & Initialized
**Next Review**: After first feature implementation
