# OpenSpec Documentation - Liga Interna

Welcome! This is your one-stop resource for understanding Liga Interna's system, architecture, and requirements. All documentation is written for both **humans** and **AI agents**.

## 📁 Directory Structure

```
openspec/
├── README.md (you are here)
├── MIGRATION-INDEX.md       ← Migration tracking from old structure
├── proposal.md              ← WHY we're doing this
├── design.md                ← HOW the system works (architecture)
├── tasks.md                 ← WHAT needs to be built (tasks & roadmap)
├── AGENT_GUIDE.md           ← HOW to use specs (for agents)
├── config.yaml              ← OpenSpec configuration
│
├── products/                ← Product definitions
│   ├── cron.md              ← CRON product (sync service)
│   └── liga-admin.md        ← LIGA-ADMIN product (React dashboard)
│
├── features/                ← Feature specifications
│   ├── cron/
│   │   └── battle-sync.md   ← Battle sync index (split into focused files)
│   └── liga-admin/
│       └── admin-dashboard.md  ← Dashboard index (split into focused files)
│
├── business-rules/          ← Business logic rules
│   ├── tournament-rules.md  ← Tournament structure & phases
│   ├── deck-validation.md   ← Card restrictions & deck rules
│   ├── scoring-system.md    ← Point calculations & rankings
│   └── player-eligibility.md ← Participation requirements
│
├── architecture/            ← Technical architecture
│   ├── system-overview.md   ← High-level design & data flow
│   ├── data-model.md        ← DB schema & entities (migrated ✓)
│   ├── cron-technical-spec.md  ← Python backend architecture (migrated ✓)
│   └── liga-admin-technical-spec.md  ← React frontend architecture (migrated ✓)
│
├── changes/                 ← Feature change tracking (OpenSpec workflow)
│   └── [change-dirs]        ← Individual change artifacts
│
└── specs/                   ← Legacy/process documentation
    └── git-workflow.md      ← Git branching & PR process
```

## 🎯 Quick Start

### For Team Members

1. **Understand the System:**
   - Read: [proposal.md](./proposal.md) (2 min) - Why we're using specs
   - Read: [design.md](./design.md) (10 min) - System overview diagram
   - Read: [architecture/system-overview.md](./architecture/system-overview.md) - Technical architecture

2. **Before You Code:**
   - Find your product in [products/](./products/) (cron or liga-admin)
   - Find your feature in [features/cron/](./features/cron/) or [features/liga-admin/](./features/liga-admin/)
   - Review relevant [business-rules/](./business-rules/) for domain logic
   - Reference [architecture/data-model.md](./architecture/data-model.md) for database schema

3. **During Development:**
   - Add spec citations in code comments (`// Ref: features/liga-admin/player-rankings.md#REQ-1`)
   - Follow patterns from [architecture/](./architecture/) technical specs
   - Test against scenarios (GIVEN/WHEN/THEN)
   - Log your work to [tasks.md](./tasks.md)

4. **When Done:**
   - Update spec if you found gaps
   - Add test results to tasks.md status
   - Follow [specs/git-workflow.md](./specs/git-workflow.md) for PR process

### For AI Agents

1. **Get Context:** Read [AGENT_GUIDE.md](./AGENT_GUIDE.md) (explains how to use OpenSpec)
2. **Find Your Product:** Start with [products/](./products/) to understand product boundaries
3. **Read Feature Specs:** Navigate to [features/](./features/) for requirements (REQ-X format)
4. **Check Business Rules:** Review [business-rules/](./business-rules/) for domain logic
5. **Reference Architecture:** Use [architecture/](./architecture/) for technical patterns
6. **Implement:** Code with spec references in comments
7. **Test:** Run scenarios from GIVEN/WHEN/THEN
8. **Document:** Include spec citations in PR description

### Navigation by Role

**Product Manager:**
- Start: [products/](./products/) → [features/](./features/) → [business-rules/](./business-rules/)
- Update: Feature specs when requirements change
- Reference: [MIGRATION-INDEX.md](./MIGRATION-INDEX.md) for migration status

**Backend Developer (CRON):**
- Start: [products/cron.md](./products/cron.md)
- Features: [features/cron/](./features/cron/)
- Architecture: [architecture/cron-technical-spec.md](./architecture/cron-technical-spec.md)
- Data: [architecture/data-model.md](./architecture/data-model.md)

**Frontend Developer (LIGA-ADMIN):**
- Start: [products/liga-admin.md](./products/liga-admin.md)
- Features: [features/liga-admin/](./features/liga-admin/)
- Architecture: [architecture/liga-admin-technical-spec.md](./architecture/liga-admin-technical-spec.md)
- UI: [features/liga-admin/admin-dashboard.md](./features/liga-admin/admin-dashboard.md)

**Architect:**
- Start: [architecture/system-overview.md](./architecture/system-overview.md)
- Review: All [architecture/](./architecture/) docs
- Validate: [business-rules/](./business-rules/) for consistency
- Process: [specs/git-workflow.md](./specs/git-workflow.md)

## 📚 Core Documents

### 1. `proposal.md` - The Vision
**Length:** 5 min read  
**Audience:** Everyone  
**Contains:**
- Why specs are important for multi-project coordination
- Benefits of OpenSpec for agents and humans
- Success metrics
- Risk mitigation

**Read this first** if you're new to the project.

### 2. `design.md` - The Architecture
**Length:** 15 min read  
**Audience:** Developers, Architects  
**Contains:**
- System diagram (Frontend, Backend, DB, API)
- Technology stack (React, Python, Supabase)
- Database schema with indexes
- API endpoints (Supabase PostgREST)
- Deployment architecture
- Monitoring strategy
- Scalability roadmap

**Read this** before starting backend or frontend features.

### 3. `tasks.md` - The Implementation Roadmap
**Length:** Reference document (use as checklist)  
**Audience:** Team leads, Developers  
**Contains:**
- Phase 1: Backend (data sync, DB setup)
- Phase 2: Frontend (components, UI)
- Phase 3: Testing & integration
- Phase 4: Deployment & monitoring
- Success criteria & timeline

**Use this** to track progress and coordinate work between projects.

### 4. `AGENT_GUIDE.md` - How to Use Specs
**Length:** 15 min read  
**Audience:** Agents, Technical Leads  
**Contains:**
- How to read spec sections (REQ-X, Scenarios)
- Navigation maps (where to find things)
- Code examples with spec citations
- Troubleshooting common issues
- Integration workflow

**Use this** as the agent's instruction manual.

## 📖 Specification Files

### `architecture/data-model.md` - The Data Layer
**Focus:** What data exists and how it's structured

**Key Sections:**
- **Player** - Supercell player with stats and clan membership
- **Clan** - Guild with metadata and war tracking
- **Battle** - Individual game result with trophy change
- **PlayerSnapshot** - Daily historical record for trends
- **War** - War event with participants and results

**Use when:** Writing code that reads/writes player, clan, or battle data

**Example:** 
```
"What fields does a Player have?"
→ Read: /openspec/architecture/data-model.md → Player interface
→ See exact field names, types, and validation rules
```

### `features/cron/battle-sync.md` - The Data Pipeline
**Focus:** How data flows from Clash API → Supabase

**Key Requirements (REQ-X):**
- REQ-1: API data ingestion (fetch frequency, rate limits)
- REQ-2: Data synchronization (upsert logic)
- REQ-3: Historical tracking (snapshots, war records)
- REQ-4: Error handling (retries, alerts)
- REQ-5: Performance (complete in <5 minutes)

**Key Scenarios:**
- Regular sync cycle (happy path)
- API rate limit hit
- Player not found (left clan)
- Duplicate battle detection
- War state transitions

**Use when:** Working on the Python cron job sync logic

**Example:**
```
"How many times should I retry a failed API request?"
→ Read: /openspec/features/cron/battle-sync.md → Error Handling
→ See: "Retry up to 5 times with exponential backoff"
```

### `features/liga-admin/admin-dashboard.md` - The User Interface
**Focus:** What the frontend displays and how users interact

**Key Requirements (REQ-X):**
- REQ-1: Player rankings (sorted, filterable)
- REQ-2: Clan overview (stats cards)
- REQ-3: Player profile (battle history, charts)
- REQ-4: Search & filter
- REQ-5: Data currency indicator
- REQ-6: War dashboard (real-time updates)
- REQ-7: Responsive design (mobile/tablet/desktop)

**Key Scenarios:**
- View clan standings
- Monitor war progress
- Analyze player history
- Search & filter players
- Refresh stale data
- Mobile dashboard view

**UI Components:**
- Header with logo, sync status, refresh button
- Layout tabs (Overview, War, Players, Settings)
- Player table with sort/filter
- Stats cards with trend indicators
- Charts (line, pie, sparkline)

**Use when:** Building React components for the frontend

**Example:**
```
"What columns should the player table have?"
→ Read: /openspec/features/liga-admin/player-rankings.md → Requirements
→ See: Table with Rank, Name, Trophies, Best, Role, Contribution
→ Mobile: hide Best & Contribution columns
```

## 🔄 How Project Coordination Works

### Cross-Project Dependencies

**Frontend needs Backend:**
- Database schema (player, clan, battles)
- API endpoints to query data
- Sync status (last updated timestamp)

**Backend needs Frontend:**
- Field definitions (what to write to DB)
- UI requirements (help plan data model)

**Both need Specs:**
- Agree on data structure before coding
- Understand performance targets
- Know test scenarios

### Typical Workflow

```
1. Team aligns on spec (this has happened!)
2. Backend: Implement data models → sync logic
3. Backend: Deploy cron job → data in Supabase
4. Frontend: Implement components to display data
5. Together: Test data flow end-to-end
6. Deploy: Frontend & backend automatically via CI/CD
```

## 🎓 Key Concepts for Agents

### What is a Spec?
A spec is **what to build** (requirements) not **how to build** it (implementation).

**Spec format: REQ-X with GIVEN/WHEN/THEN scenarios**
```
REQ-1: Player Rankings
The system SHALL display ranked list sorted by trophies

Scenario: View Clan Standings
- GIVEN admin opens dashboard
- WHEN dashboard loads
- THEN display player table sorted by trophies descending
```

### How Specs Guide Implementation
1. **Read REQ-X** → Understand requirement
2. **Check Scenarios** → See test cases
3. **Link Data Models** → Understand validation
4. **Code with Citations** → Reference spec in comments
5. **Test Against Scenarios** → Verify GIVEN/WHEN/THEN

### Why Specs Matter for Agents
- ✅ No guessing about requirements
- ✅ Test cases built-in (scenarios)
- ✅ Data validation rules explicit
- ✅ Cross-project alignment guaranteed
- ✅ Easy to review (compare code to spec)

## 💡 Common Questions

### Q: I need to implement a feature. Where do I start?
**A:** 
1. Find your feature name in `/openspec/features/`
2. Read the REQ-X section
3. Read the Scenario(s)
4. Check data models in `/openspec/architecture/data-model.md`
5. Implement per spec + test against scenario

### Q: What if the spec doesn't cover my use case?
**A:**
1. Search again carefully (use Ctrl+F)
2. If still missing, propose spec update
3. Document decision in code with note:
   ```python
   # NOTE: Spec doesn't cover [case], implementing with [approach]
   # See /openspec/features/cron/battle-sync.md
   ```

### Q: Can I change the spec if I find a better approach?
**A:**
1. Try to implement per spec first
2. If spec approach doesn't work, propose alternative
3. Update spec with rationale:
   ```markdown
   ### Change: Increased retry attempts
   OLD: max_retries = 3
   NEW: max_retries = 5
   Rationale: 3 attempts failed 8% of requests. 
   5 attempts achieves 98% success rate [source: PR #123].
   ```

### Q: How do I know if my implementation matches the spec?
**A:**
1. Check all REQ-X sections are implemented
2. Test each GIVEN/WHEN/THEN scenario
3. Validate per data model rules
4. Meet performance targets from design.md
5. Add spec citations in code

### Q: What's the difference between frontend and backend specs?
**A:**
- **Backend** (`features/cron/battle-sync.md`): How data flows, sync logic, error handling
- **Frontend** (`features/liga-admin/admin-dashboard.md`): What users see, UI components, interactions
- **Shared** (`architecture/data-model.md`): Data structure both use

### Q: How do agents help with specs?
**A:**
- Agents read specs to understand requirements
- Agents cite specs in code comments
- Agents test code against spec scenarios
- Agents propose spec updates when needed

## 📋 Implementation Checklist

Before claiming a feature is done:

- [ ] Read relevant spec section(s)
- [ ] Implemented all REQ-X requirements
- [ ] Tested all scenarios (GIVEN/WHEN/THEN)
- [ ] Added spec citations in code comments
- [ ] Validated per data model rules
- [ ] Meets performance targets
- [ ] Created unit + integration tests
- [ ] Updated `/openspec/tasks.md` status
- [ ] Proposed any spec updates needed

## 🚀 Getting Started (For Teams)

### Day 1: Onboarding
1. Read: `proposal.md` (understand why specs)
2. Read: `design.md` (understand system)
3. Read: `AGENT_GUIDE.md` (understand how to use specs)

### Week 1: Backend Setup
1. Focus: `tasks.md` → Phase 1 (Data Layer & Backend)
2. Reference: `architecture/data-model.md` + `features/cron/battle-sync.md`
3. Build: Database, Clash API client, sync engine

### Week 2-3: Frontend
1. Focus: `tasks.md` → Phase 2 (Frontend)
2. Reference: `features/liga-admin/admin-dashboard.md` + `design.md`
3. Build: React components, charts, filters

### Week 3-4: Testing & Deploy
1. Focus: `tasks.md` → Phase 3-4
2. Test: All scenarios from specs
3. Deploy: CI/CD automation

## 📞 Getting Help

**For spec questions:**
- Search this directory
- Check `/openspec/AGENT_GUIDE.md` for common scenarios
- Ask: "Where in specs does it say [feature]?"

**For implementation questions:**
- Check `/openspec/design.md` (system overview)
- Check `/openspec/tasks.md` (implementation steps)
- Reference code with spec citations

**For updating specs:**
- Propose changes with rationale
- Update relevant files with clear notes
- Commit spec changes with code changes

## 🎯 Success Criteria

This OpenSpec setup is successful when:

1. ✅ **Alignment:** Both projects follow same data models (zero mismatches)
2. ✅ **Clarity:** New developers understand system in 1 day
3. ✅ **Agent Support:** Agents cite specs in 100% of PRs
4. ✅ **Maintenance:** Specs stay <1 week behind code
5. ✅ **Quality:** All scenarios tested (GIVEN/WHEN/THEN)
6. ✅ **Performance:** Targets met (sync <5min, queries <200ms)

## 📦 Related Files

**At repo root:**
- `packages/liga-admin/package.json` - Frontend dependencies
- `packages/cron/requirements.txt` - Backend dependencies
- `DEVELOPMENT_BACKLOG.md` - Original roadmap (now in tasks.md)

**Not in openspec/ but important:**
- `packages/liga-admin/` - React frontend code
- `packages/cron/` - Python backend code
- `docs/` - Additional documentation

## ✍️ Document Maintenance

**Current Status:** OpenSpec setup complete ✅

**Last Updated:** 2026-02-18

**Maintained By:** Team

**Review Cycle:** Every 2 weeks or after major changes

**Version:** 1.0 (MVP)

---

## 🎓 Training Resources

- **For Humans:** Start with `proposal.md` then `design.md`
- **For Agents:** Start with `AGENT_GUIDE.md` then relevant spec
- **For Leads:** `tasks.md` is your roadmap
- **For Developers:** Bookmark specs in your editor

## 🔗 Navigation Quick Links

- [📋 Proposal](./proposal.md) - Why specs matter
- [🏗️ Design](./design.md) - System architecture
- [✅ Tasks](./tasks.md) - Implementation roadmap
- [🤖 Agent Guide](./AGENT_GUIDE.md) - How to use specs
- [📊 Data Models](./architecture/data-model.md) - Entities
- [🔄 Cron Sync](./features/cron/battle-sync.md) - Backend
- [🎨 Dashboard](./features/liga-admin/admin-dashboard.md) - Frontend

---

**Questions? Read the specs. Can't find answer? Check AGENT_GUIDE.md. Still stuck? Ask the team.**

Good luck! 🚀
