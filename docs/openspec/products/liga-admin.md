# Product: LIGA-ADMIN (Tournament Management Dashboard)

**Product Type**: Web Application (SPA)  
**Status**: ✅ Active Production  
**Version**: 1.0  
**Repository**: `packages/liga-admin/`

---

## Purpose

LIGA-ADMIN is a **Single Page Application (SPA)** that provides administrators with a comprehensive web interface to manage Liga Interna—an internal Clash Royale tournament system. It serves as the **command center** for tournament operations, enabling real-time monitoring, player management, team organization, and statistical analysis.

### Why LIGA-ADMIN Exists

Liga Interna is a structured tournament involving **53 active players** organized into **6 teams** across multiple competitive zones. Tournament administrators (~5-10 users) need to:
- Track daily player participation and points
- Manage team rosters and assign captains
- Configure tournament phases (regular season, playoffs, extreme mode)
- Monitor battle statistics and validate deck composition
- Calculate rankings and determine winners
- Handle player substitutions and roster changes

Without LIGA-ADMIN, these tasks would require manual spreadsheet management, WhatsApp coordination, and error-prone calculations—impractical for a dynamic, fast-paced tournament environment.

---

## Capabilities

### Core Functions

1. **Tournament Administration**
   - Create and configure seasons (start/end dates, phases, rules)
   - Define zones (20-player competitive brackets)
   - Set up teams (5 players per team with captain assignments)
   - Manage tournament progression (regular season → playoffs → finals)

2. **Player Management**
   - Register players and link Clash Royale tags
   - Edit player profiles (name, tag, role, active status)
   - Track player eligibility and participation history
   - Assign players to zones and teams
   - Handle substitutions and roster swaps

3. **Team Organization**
   - Create teams with custom names and logos
   - Assign team captains with special privileges
   - Manage team membership (5 players per team)
   - Track team statistics (wins, losses, points)
   - Schedule inter-team matches

4. **Battle Tracking & Validation**
   - Display complete battle history (1500+ battles)
   - Filter battles by date, player, zone, match type
   - View detailed battle breakdowns (rounds, decks, crowns)
   - Validate deck composition against tournament rules
   - Identify ineligible card usage (banned/restricted cards)

5. **Points & Rankings System**
   - Calculate daily points based on battle participation
   - Apply tournament scoring rules (see [business-rules/scoring-system.md](../business-rules/scoring-system.md))
   - Generate zone rankings (sorted by points, trophies, battles)
   - Handle tie-breakers (battles played, wins, card levels)
   - Drag-and-drop manual ranking adjustments (for special scenarios)

6. **Extreme Mode Configuration**
   - Toggle "Extreme" or "Risky" mode for high-stakes tournaments
   - Define risk multipliers (2x, 3x points)
   - Assign risky players (high-risk, high-reward)
   - Track performance under pressure scenarios

7. **Real-Time Data Synchronization**
   - Poll Supabase for fresh battle data (synced by CRON)
   - Display data currency indicator ("Updated 2 minutes ago")
   - Manual refresh button for immediate data fetch
   - Warn administrators if data exceeds 2-hour staleness threshold

8. **Authentication & Authorization**
   - Email/password authentication via Supabase Auth
   - Session management with JWT tokens
   - Protected routes (redirect to login if unauthenticated)
   - Role-based access control (future: admin vs. viewer roles)

---

## Technology Stack

### Frontend Framework
- **React 19.2.0** - Latest React with concurrent features
- **React Router 7.11.0** - Client-side routing (32 admin pages)
- **Vite 7.2.4** - Build tool and dev server (HMR, ESM-first)

### Styling & UI
- **Tailwind CSS 4.1.18** - Utility-first CSS framework
- **lucide-react** - Icon library (clean, consistent icons)
- **@dnd-kit** - Drag-and-drop library (for ranking adjustments)

### Backend & Database
- **Supabase** - Backend as a Service (BaaS)
  - PostgreSQL database (35+ tables)
  - Real-time subscriptions (future feature)
  - Authentication service (email/password)
  - Storage service (team logos, S3-compatible)
  - PostgREST API (direct SQL queries from frontend)

### Build & Deployment
- **Vite** - Production bundling with code splitting
- **Static hosting** - Deployable to Netlify, Vercel, Cloudflare Pages
- **Environment variables** - `.env` for Supabase configuration

---

## Key Features

### 1. Admin Dashboard
**Feature**: [admin-dashboard.md](../features/liga-admin/admin-dashboard.md)

Central hub displaying:
- Clan overview (total trophies, member count, war record)
- Player rankings (sortable by trophies, points, battles)
- Recent battles (last 20 with quick filters)
- Sync status indicator (data freshness)
- Quick navigation to all admin functions

### 2. Player Management
**Pages**: `PlayersList.jsx`, `PlayerEdit.jsx`, `PlayerProfile.jsx`

Capabilities:
- View all registered players (53 active players)
- Search by name or Clash Royale tag
- Edit player details (name, tag, role, active status)
- View player battle history (last 100 battles)
- Link players to internal database records
- Track player participation across seasons

### 3. Team Management
**Pages**: `TeamsList.jsx`, `TeamEdit.jsx`, `TeamFormation.jsx`

Capabilities:
- Create teams (6 teams in current season)
- Assign 5 players per team (1 captain + 4 members)
- Upload team logos (stored in Supabase Storage)
- Define team colors and custom names
- Track team performance metrics

### 4. Battle History Explorer
**Page**: `BattlesHistory.jsx` (⚠️ 1353 lines - largest component)

Capabilities:
- Paginated table of all battles (1500+ records)
- Filter by date range, player, battle type, mode
- Sort by timestamp, trophies, crowns, elixir
- View detailed battle breakdowns (modal)
- Export battle data (CSV/JSON)
- Identify incomplete battles (needs refresh)

**Note**: This component is a known technical debt item requiring refactoring into smaller, focused components.

### 5. Season Rankings System
**Pages**: `SeasonZoneRankings.jsx`, `SeasonDailyPoints.jsx` (583 lines)

Capabilities:
- Calculate daily points based on battle participation
- Apply tournament rules (see [docs/REGALAMENTO.md](../../docs/REGALAMENTO.md))
- Generate zone rankings (zones of 20 players each)
- Manual ranking adjustments via drag-and-drop
- Historical snapshot of rankings per day
- Export final standings for tournament records

**Scoring Algorithm** (simplified):
```javascript
// Daily points calculation
points = battles_played * base_multiplier
if (extreme_mode && is_risky_player) {
  points *= risk_multiplier
}
if (inactivity_days >= 1) {
  points -= inactivity_penalty
}
```

### 6. Extreme Mode Dashboard
**Page**: `SeasonExtreme.jsx`

Capabilities:
- Enable/disable Extreme (high-stakes) mode
- Define risk levels (2x, 3x, 5x multipliers)
- Assign "risky" players for high-reward scenarios
- Track performance under extreme conditions
- Override points for exceptional plays

### 7. Scheduled Matches System
**Pages**: `ScheduledMatchesList.jsx`, `ScheduledMatchEdit.jsx`

Capabilities:
- Create scheduled team vs. team matches
- Define match format (best-of-3, best-of-5)
- Set match dates and deadlines
- Track match completion status
- Record match results (winner, scores)
- Integrate match results into rankings

### 8. War Dashboard (Clan Wars)
**Page**: `WarDashboard.jsx` (from REQ-6 in admin-dashboard.md)

Capabilities:
- Show active war status (collection day / war day)
- Display war participants and attack status
- Track remaining attacks (crowns needed)
- Show opponent clan stats (comparison)
- Record final war results (win/loss/draw)
- Maintain war win/loss streak history

### 9. Data Currency Monitoring
**Component**: `DataCurrencyIndicator` (embedded in layout)

Capabilities:
- Display last sync timestamp from CRON
- Calculate data age ("Updated 5 minutes ago")
- Warn if data exceeds 2-hour staleness
- Provide manual refresh button
- Poll for updates every 60 seconds (configurable)

---

## Architecture

### High-Level Component Structure

```
┌─────────────────────────────────────────────────────────┐
│                    Browser (Client)                     │
├─────────────────────────────────────────────────────────┤
│  React SPA (Vite)                                       │
│  ├─ App.jsx (AuthProvider wrapper)                      │
│  ├─ routes.jsx (32 routes defined)                      │
│  ├─ components/                                         │
│  │   ├─ AdminLayout.jsx (navbar + Outlet)              │
│  │   ├─ ProtectedRoute.jsx (auth guard)                │
│  │   └─ Modals (BattleDetail, MatchEdit, etc.)         │
│  ├─ context/                                            │
│  │   └─ AuthContext.jsx (global session state)         │
│  ├─ pages/admin/ (32 admin pages)                      │
│  │   ├─ DashboardAdmin.jsx                             │
│  │   ├─ PlayersList.jsx / PlayerEdit.jsx               │
│  │   ├─ TeamsList.jsx / TeamEdit.jsx                   │
│  │   ├─ BattlesHistory.jsx (1353 lines ⚠️)            │
│  │   ├─ SeasonZoneRankings.jsx                         │
│  │   └─ ... (23 more)                                   │
│  └─ lib/                                                │
│      └─ supabaseClient.js (singleton instance)         │
└─────────────────────────────────────────────────────────┘
                          ↓ HTTPS (REST + Auth)
┌─────────────────────────────────────────────────────────┐
│           Supabase (Backend as a Service)               │
├─────────────────────────────────────────────────────────┤
│  • Auth Service (email/password, JWT sessions)          │
│  • PostgreSQL (35+ tables, views, indexes)              │
│  • Storage (team logos, S3-compatible)                  │
│  • PostgREST (auto-generated REST API)                  │
│  • (Future) Real-time subscriptions (WebSockets)        │
└─────────────────────────────────────────────────────────┘
```

### Technical Architecture
**Reference**: [architecture/liga-admin-technical-spec.md](../architecture/liga-admin-technical-spec.md)

Key patterns:
- **Single Supabase Client**: Singleton instance in `lib/supabaseClient.js`
- **Direct Database Queries**: Components call `supabase.from('table').select()` directly
- **Authentication Context**: Global session state via `AuthContext.jsx`
- **Protected Routes**: `ProtectedRoute` wrapper redirects unauthenticated users
- **No State Management Library**: Uses native React `useState`, `useEffect`, Context API
- **Tailwind-First Styling**: Inline utility classes, minimal custom CSS

---

## Dependencies

### Upstream Dependencies (What LIGA-ADMIN Relies On)

1. **Supabase Instance**
   - Database schema (35+ tables, see [architecture/data-model.md](../architecture/data-model.md))
   - Anonymous key (`anon_key`) for client-side queries
   - Real-time subscriptions endpoint (future feature)
   - Storage bucket for team logos

2. **CRON Sync Service** (data provider)
   - Fresh battle data synced every 30 minutes
   - Player statistics updated automatically
   - Clan member list kept current
   - Data quality (complete decks, validated battles)

3. **Supercell Clash Royale Data** (indirect dependency via CRON)
   - Clan member roster
   - Battle logs and history
   - Player trophies and statistics
   - Card catalog and metadata

### Downstream Consumers (What Relies On LIGA-ADMIN)

1. **Tournament Administrators** (~5-10 users)
   - Daily tournament operations
   - Points calculation and rankings
   - Player roster management
   - Match scheduling and results

2. **Team Captains** (6 captains, future feature)
   - View team roster and statistics
   - Request substitutions
   - Coordinate with team members
   - Track team performance

3. **Tournament Reports** (future integration)
   - Export final standings
   - Generate season summaries
   - Archive historical data

---

## System Context

### User Roles

| Role | Count | Capabilities | Authentication |
|------|-------|--------------|----------------|
| **Admin** | ~5-10 | Full access to all features | Email/password (Supabase Auth) |
| **Viewer** (future) | ~20-30 | Read-only access to rankings/battles | Email/password |
| **Captain** (future) | 6 | Team management only | Email/password |

**Note**: Currently, all authenticated users have admin privileges. Role-based access control (RBAC) is planned for future implementation.

### Browser Compatibility
- **Chrome/Edge** 90+ (primary target)
- **Firefox** 88+
- **Safari** 14+
- **Mobile browsers** (iOS Safari, Chrome Mobile)

### Responsive Design Breakpoints
- **Desktop**: 1920px+ (primary use case)
- **Laptop**: 1366px - 1920px
- **Tablet**: 768px - 1365px
- **Mobile**: 320px - 767px (limited functionality)

**Note**: Some complex tables (e.g., BattlesHistory) are difficult to use on mobile. Responsive improvements are planned.

---

## Configuration

### Environment Variables
```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://xxx.supabase.co         # Required
VITE_SUPABASE_ANON_KEY=eyJhbGc...                 # Required (public anon key)

# Feature Flags (optional)
VITE_ENABLE_REALTIME=false                        # Default: false
VITE_ENABLE_EXPORT=true                           # Default: true
VITE_POLL_INTERVAL_MS=60000                       # Default: 60000 (1 minute)
```

### File Structure
```
packages/liga-admin/
├── src/
│   ├── main.jsx                    # Entry point
│   ├── App.jsx                     # Root component
│   ├── index.css                   # Tailwind imports
│   ├── app/
│   │   └── routes.jsx              # Route definitions (32 routes)
│   ├── components/
│   │   ├── AdminLayout.jsx         # Layout wrapper
│   │   ├── ProtectedRoute.jsx      # Auth guard
│   │   └── ...modals
│   ├── context/
│   │   └── AuthContext.jsx         # Global auth state
│   ├── lib/
│   │   └── supabaseClient.js       # Supabase singleton
│   └── pages/admin/                # 32 admin pages
├── public/                         # Static assets
├── index.html                      # HTML template
├── vite.config.js                  # Vite configuration
├── tailwind.config.cjs             # Tailwind configuration
├── package.json                    # Dependencies
└── README.md                       # Setup guide
```

---

## Integration Points

### Supabase Tables Read By LIGA-ADMIN

| Table | Purpose | Primary Queries |
|-------|---------|-----------------|
| `player` | Player roster | SELECT with filters, UPDATE profile |
| `team` | Team definitions | SELECT all, INSERT/UPDATE team data |
| `battle` | Battle history | SELECT with pagination/filters |
| `battle_round` | Round details | JOIN with battle for breakdown |
| `battle_round_player` | Player stats | JOIN for deck/crowns display |
| `season` | Season config | SELECT active season |
| `zone` | Zone definitions | SELECT for rankings |
| `daily_points` | Points tracking | SELECT/INSERT daily points |
| `ranking_snapshot` | Historical rankings | SELECT for trends |
| `scheduled_match` | Match schedule | SELECT/UPDATE match status |
| `card` | Card catalog | SELECT for deck validation |

### Supabase Tables Written By LIGA-ADMIN

| Table | Write Operations | Purpose |
|-------|------------------|---------|
| `player` | INSERT, UPDATE, DELETE | Player management |
| `team` | INSERT, UPDATE, DELETE | Team creation/editing |
| `season` | INSERT, UPDATE | Season configuration |
| `zone` | INSERT, UPDATE | Zone setup |
| `daily_points` | INSERT, UPDATE | Points calculation |
| `ranking_snapshot` | INSERT | Ranking archival |
| `scheduled_match` | INSERT, UPDATE | Match scheduling |
| `player_substitution` | INSERT | Roster changes |

**Note**: LIGA-ADMIN does **NOT** write to `battle`, `battle_round`, or `battle_round_player`. These are managed exclusively by CRON to maintain data integrity.

---

## Feature Roadmap

### Current Features (v1.0)
- ✅ Player management (add, edit, deactivate)
- ✅ Team formation and captain assignment
- ✅ Battle history explorer with filters
- ✅ Daily points calculation
- ✅ Zone rankings with manual adjustments
- ✅ Extreme mode configuration
- ✅ Scheduled match management
- ✅ Authentication and session management

### Planned Features (v1.1 - v1.3)
- [ ] **Real-time Updates** (Supabase subscriptions)
  - Live battle notifications
  - Instant ranking updates
  - Multi-user collaboration support

- [ ] **Role-Based Access Control (RBAC)**
  - Admin vs. Viewer vs. Captain roles
  - Permission-based UI rendering
  - Audit logs for admin actions

- [ ] **Advanced Analytics**
  - Player performance trends (charts)
  - Win rate analysis by deck archetype
  - Head-to-head statistics
  - Tournament bracket visualization

- [ ] **Export & Reporting**
  - CSV/Excel export for all tables
  - PDF tournament summaries
  - Season archive reports
  - Email notifications for results

- [ ] **Mobile App** (PWA)
  - Progressive Web App conversion
  - Offline support for critical data
  - Push notifications for matches
  - Touch-optimized UI

- [ ] **Deck Builder Integration**
  - Import decks from Clash Royale API
  - Validate against banned cards
  - Suggest meta decks
  - Track deck usage statistics

### Technical Debt (Refactoring)
- [ ] **Split Large Components**
  - `BattlesHistory.jsx` (1353 lines) → Break into sub-components
  - `SeasonDailyPoints.jsx` (583 lines) → Extract calculation logic

- [ ] **Implement State Management**
  - Consider Zustand or Jotai for global state
  - Reduce prop drilling in deep component trees

- [ ] **Add Type Safety**
  - Migrate to TypeScript (currently plain JavaScript)
  - Generate types from Supabase schema

- [ ] **Test Coverage**
  - Unit tests for business logic (points calculation)
  - Integration tests for critical flows (auth, ranking)
  - E2E tests with Playwright

- [ ] **Performance Optimization**
  - Virtual scrolling for large tables (react-window)
  - Memoization for expensive calculations
  - Code splitting per route (lazy loading)

---

## Related Documentation

### Feature Specifications
- [features/liga-admin/admin-dashboard.md](../features/liga-admin/admin-dashboard.md) - Dashboard requirements (REQ-1 through REQ-7)

### Architecture
- [architecture/liga-admin-technical-spec.md](../architecture/liga-admin-technical-spec.md) - Complete technical architecture (624 lines)
- [architecture/data-model.md](../architecture/data-model.md) - Database schema and entities
- [architecture/system-overview.md](../architecture/system-overview.md) - System-wide architecture

### Business Rules
- [business-rules/tournament-rules.md](../business-rules/tournament-rules.md) - Tournament phases, zones, teams
- [business-rules/scoring-system.md](../business-rules/scoring-system.md) - Points calculation algorithm
- [business-rules/player-eligibility.md](../business-rules/player-eligibility.md) - Participation requirements
- [business-rules/deck-validation.md](../business-rules/deck-validation.md) - Card restrictions and banned lists

### Setup & Operations
- [packages/liga-admin/README.md](../../packages/liga-admin/README.md) - Installation and development guide
- [docs/REGALAMENTO.md](../../docs/REGALAMENTO.md) - Complete tournament rules (Spanish, 1395 lines)

---

## Success Metrics

**User Adoption**: 100% of administrators use LIGA-ADMIN (replaced spreadsheets)  
**Uptime**: 99.9% availability during tournament hours  
**Performance**: <2 seconds page load time on 3G connection  
**Data Accuracy**: Zero manual ranking corrections needed (automated calculation)  
**User Satisfaction**: 4.5/5 administrator rating (internal feedback)

---

## Support & Maintenance

**Primary Maintainer**: Frontend Team  
**Code Reviews**: Required for all PRs (2 approvals minimum)  
**Deployment**: Continuous deployment on `main` branch push  
**Monitoring**: Vercel Analytics + Supabase Dashboard  
**Issue Tracking**: GitHub Issues with labels (bug, feature, enhancement)

---

*Last Updated: February 18, 2026*  
*Maintained By: Frontend Team*  
*Version: 1.0*
