# Card Restrictions (RES) System

## Overview

The Card Restrictions (RES) system enables administrators to prohibit specific players from using specific cards within a season. This feature supports competitive balance enforcement, fair play rules, and meta diversity management.

## Change Artifacts

This directory contains the complete OpenSpec documentation for implementing the RES feature:

### 1. [proposal.md](./proposal.md)
**Purpose:** Business justification and high-level requirements

**Key Sections:**
- Why this feature matters (competitive balance, fair play)
- What changes are needed (database, UI, business logic)
- User capabilities and workflows
- Business value and impact assessment
- Implementation timeline (~11 days)

**Read this first** to understand the strategic value and scope.

---

### 2. [design.md](./design.md)
**Purpose:** Technical architecture and design decisions

**Key Sections:**
- Database schema (`season_card_restriction` table)
- Data flow diagrams
- Component architecture (two-page flow)
- Security considerations (RLS policies)
- Performance optimization strategies
- Error handling patterns
- Testing strategy

**Read this second** to understand how the feature will be built.

---

### 3. Capability Specifications

Located in `specs/` directory. Each spec defines a specific capability with user stories, BDD scenarios, technical implementation, and UI design.

#### [specs/res-admin-management.md](./specs/res-admin-management.md)
- **Capability:** List view, search, filter, delete operations
- **Route:** `/admin/seasons/:seasonId/restrictions`
- **Components:** SeasonRestrictions page, RestrictionCard component
- **Features:**
  - View all restrictions grouped by player
  - Search by player or card name
  - Filter by zone
  - Delete single restriction
  - Delete all player restrictions
  - Real-time updates via Supabase subscriptions
  - Undo functionality (5-10 seconds)

#### [specs/res-card-selector.md](./specs/res-card-selector.md)
- **Capability:** Visual card selection with rarity filtering
- **Component:** CardGrid (reusable)
- **Features:**
  - Display all cards in responsive grid
  - Filter by rarity (champion, legendary, epic, rare, common)
  - Search by card name
  - Multi-select with visual feedback
  - Rarity-based styling (borders, colors)
  - Empty states and loading skeletons

#### [specs/res-player-selector.md](./specs/res-player-selector.md)
- **Capability:** Multi-select player interface with zone grouping
- **Component:** PlayerMultiSelect (reusable)
- **Features:**
  - Searchable player dropdown
  - Player chips with avatars
  - Zone grouping in dropdown
  - Multi-select with remove buttons
  - "Clear All" functionality
  - Debounced search (300ms)

#### [specs/res-bulk-operations.md](./specs/res-bulk-operations.md)
- **Capability:** Batch create/delete restrictions
- **Route:** `/admin/seasons/:seasonId/restrictions/edit`
- **Components:** SeasonRestrictionEdit page
- **Features:**
  - Select N players × M cards → N×M restrictions
  - Preview matrix before applying
  - Duplicate detection and handling
  - Batch upsert (50 restrictions per batch)
  - Partial success handling
  - Progress indicator
  - Optional reason field with templates

---

### 4. [tasks.md](./tasks.md)
**Purpose:** Implementation breakdown into actionable tasks

**Key Sections:**
- 11 task groups organized by dependency
- Estimated time per group (0.5 - 2 days each)
- Detailed checklist items (T1.1, T1.2, etc.)
- Dependency graph showing build order
- Timeline summary (11-day plan)
- Risk mitigation strategies
- Success criteria

**Use this** to track implementation progress and assign work.

---

## Quick Start

### For Product Managers
1. Read [proposal.md](./proposal.md) for business context
2. Review capability specs to understand user workflows
3. Use this to communicate value to stakeholders

### For Developers
1. Skim [proposal.md](./proposal.md) for context
2. Study [design.md](./design.md) for technical architecture
3. Reference capability specs during implementation
4. Follow [tasks.md](./tasks.md) checklist step-by-step

### For Testers
1. Read capability specs for acceptance criteria
2. Use BDD scenarios in specs as test cases
3. Refer to Task Group 10 for E2E test requirements

---

## Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| **Two-page flow** | Separate list view and bulk editor for clarity |
| **Supabase upsert** | Graceful duplicate handling via `UNIQUE` constraint |
| **Client-side card filtering** | Fast response (<5KB card catalog) |
| **Server-side player search** | Better for large player lists (100+) |
| **Batching (50 per request)** | Balance performance and reliability |
| **Real-time subscriptions** | Immediate updates for collaborative admin use |
| **Rarity from raw_payload** | Leverage existing card data from Supercell API |

---

## Data Model

### New Table: `season_card_restriction`

```sql
CREATE TABLE season_card_restriction (
    restriction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    season_id UUID NOT NULL REFERENCES season(season_id),
    player_id UUID NOT NULL REFERENCES player(player_id),
    card_id UUID NOT NULL REFERENCES card(card_id),
    reason TEXT,
    created_by UUID REFERENCES player(player_id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(season_id, player_id, card_id)
);
```

**Indexes:**
- `idx_restriction_season_player` on `(season_id, player_id)`
- `idx_restriction_season` on `(season_id)`
- `idx_restriction_player` on `(player_id)`

**RLS Policies:**
- Admins: Full access (SELECT, INSERT, UPDATE, DELETE)
- Players: SELECT own restrictions only (future use)

---

## User Workflows

### Workflow 1: Create Bulk Restrictions
1. Admin navigates to Restrictions page
2. Clicks "+ Add Restriction"
3. Selects 3 players (e.g., John, Jane, Bob)
4. Selects 5 cards (e.g., Archer Queen, Dark Prince, Fireball, Goblin Barrel, Ice Spirit)
5. Optionally adds reason: "Tournament Rule - Extreme Mode"
6. Views preview matrix (15 restrictions: 3×5)
7. Confirms and applies
8. System creates 15 restrictions in < 5 seconds
9. Navigates back to list view showing new restrictions

### Workflow 2: Delete Single Restriction
1. Admin views restrictions list
2. Hovers over restricted card on player's card
3. Clicks remove (×) button
4. Confirms deletion
5. Card disappears from UI immediately
6. "Undo" option available for 5 seconds

### Workflow 3: Search and Filter
1. Admin views restrictions list (100 players)
2. Types "john" in search bar
3. List filters to show only players named John or cards named John
4. Clicks zone filter: "Zone A"
5. Further narrows results
6. Clears filters to see all again

---

## Testing Coverage

### Unit Tests (via Task Group)
- T3.5: Service layer functions
- T4.9: CardGrid component
- T5.10: PlayerMultiSelect component
- T6.6: RestrictionCard component

### E2E Tests (Task Group 10)
- View restrictions list
- Search restrictions
- Delete single restriction
- Delete all player restrictions
- Create bulk restrictions
- Handle duplicates
- Validation errors
- Real-time updates

---

## Implementation Timeline

| Days | Focus | Deliverable |
|------|-------|-------------|
| 1 | Database | Migration applied, RLS policies active |
| 2 | Services | Card utils + Supabase service layer |
| 3-4 | CardGrid | Reusable card selector component |
| 5-6 | PlayerSelect | Reusable player multi-select component |
| 6.5 | RestrictionCard | Player restriction display component |
| 7-8 | List Page | SeasonRestrictions view with real-time updates |
| 9-10 | Edit Page | SeasonRestrictionEdit bulk creation interface |
| 10.5 | Navigation | AdminLayout integration |
| 11 | Testing | E2E tests passing |
| 11.5 | Polish | Documentation, performance tuning, accessibility |

**Total:** 11 days (single developer)

---

## Success Metrics

### Performance
- List view loads in < 1 second (100 restrictions)
- Bulk create 100 restrictions in < 5 seconds
- Real-time updates appear within 2 seconds
- Card grid renders all cards in < 500ms

### Functionality
- ✅ Create bulk restrictions (N players × M cards)
- ✅ View restrictions grouped by player
- ✅ Search by player name or card name
- ✅ Filter by zone
- ✅ Delete single restriction with undo
- ✅ Delete all player restrictions
- ✅ Handle duplicates gracefully
- ✅ Real-time updates across admin sessions

### Quality
- ✅ All E2E tests pass
- ✅ Mobile responsive
- ✅ Keyboard navigation functional
- ✅ ARIA labels present
- ✅ Error states handled
- ✅ Loading states smooth

---

## Dependencies

### Existing Tables
- `season` - Season metadata
- `player` - Player profiles
- `card` - Card catalog with `raw_payload` (from Supercell API)
- `season_zone_team_player` - Player participation per season

### Existing Components
- `ProtectedRoute` - Admin authentication wrapper
- `AdminLayout` - Navigation shell
- Toast notification system
- Confirmation dialog component

### External Libraries
- Supabase JS client (real-time subscriptions, RLS)
- Material Symbols font (icons)
- Tailwind CSS (styling)
- React Router (navigation)

---

## Future Enhancements

Not included in initial implementation, but documented for future consideration:

1. **Import/Export**
   - Import restrictions from CSV
   - Export restrictions as CSV/JSON

2. **Advanced Analytics**
   - Most/least restricted cards
   - Restriction trends over seasons
   - Player restriction history

3. **Player Portal Integration**
   - Show restrictions to players in their dashboard
   - Notify players when restricted

4. **Deck Validation Integration**
   - Automatically invalidate battles if restricted cards used
   - Show warnings during battle submission

5. **Templated Restriction Sets**
   - Save common restriction patterns
   - Quick apply "Ban all champions" template

6. **Audit Log**
   - Track who created/deleted each restriction
   - Historical change timeline

---

## Questions or Issues?

- **Product questions:** Review [proposal.md](./proposal.md) and capability specs
- **Technical questions:** Check [design.md](./design.md)
- **Implementation blockers:** See [tasks.md](./tasks.md) dependency graph
- **Testing guidance:** Refer to BDD scenarios in capability specs

---

## Document Status

- ✅ Proposal: Complete
- ✅ Design: Complete
- ✅ Capability Specs: Complete (4 specs)
- ✅ Tasks: Complete (11 groups, 80+ tasks)
- ⏳ Implementation: Not started
- ⏳ Testing: Not started
- ⏳ Documentation: Not started

**Next Step:** Begin Task Group 1 (Database Schema & Migration)
