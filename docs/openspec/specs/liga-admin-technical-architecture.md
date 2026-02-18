# Liga Admin - Technical Architecture

## 1. Executive Summary

**Purpose**: Web administration system for managing an internal Clash Royale league  
**Type**: Single Page Application (SPA)  
**Status**: Active production  
**Users**: League administrators (~5-10 users)  
**Scale**: 53 players, 6 teams, 1500+ recorded battles

### Core Technologies
- **Frontend**: React 19.2.0, Vite 7.2.4, React Router 7.11.0
- **Styling**: Tailwind CSS 4.1.18
- **Backend/DB**: Supabase (PostgreSQL + BaaS)
- **Auth**: Supabase Auth (Email/Password)
- **Special Libraries**: @dnd-kit (drag & drop), lucide-react (icons)

---

## 2. High-Level Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    Browser / Client                          │
├──────────────────────────────────────────────────────────────┤
│  React SPA (Vite)                                            │
│  ├─ Pages (32 admin pages)                                   │
│  ├─ Components (Layout, Modals, Guards)                      │
│  ├─ Context (AuthContext)                                    │
│  └─ Supabase Client (singleton)                              │
│     └─ Direct queries: supabase.from('table').select()       │
└──────────────────────────────────────────────────────────────┘
                          ↓ HTTPS
┌──────────────────────────────────────────────────────────────┐
│              Supabase (Backend as a Service)                 │
├──────────────────────────────────────────────────────────────┤
│  Auth Service (email/password, sessions, JWT)               │
│  PostgreSQL Database (35+ tables)                            │
│  Storage (S3-compatible, team logos)                         │
│  Row Level Security (RLS) - currently not implemented       │
└──────────────────────────────────────────────────────────────┘
                          ↑
┌──────────────────────────────────────────────────────────────┐
│            Python Cron Job (Clash Royale Sync)               │
│  - Gets battles from Supercell API every 30min              │
│  - Inserts/updates data in Supabase                          │
└──────────────────────────────────────────────────────────────┘
```

### Data Flow
1. **User** accesses app → React Router handles navigation
2. **Authentication** → Supabase Auth validates session → JWT in localStorage
3. **Query data** → Component calls `supabase.from('table').select()` directly
4. **Render** → useState updates state → React renders UI
5. **Modifications** → `supabase.from('table').insert/update()` → PostgreSQL
6. **Background sync** → Python cron synchronizes battles every 30min

---

## 3. Code Structure

```
src/
├── main.jsx                    # Entry point, ReactDOM.render
├── App.jsx                     # Root component, AuthProvider wrapper
├── index.css                   # Global Tailwind imports
│
├── app/
│   └── routes.jsx              # React Router 7 route definitions
│
├── components/
│   ├── AdminLayout.jsx         # Layout with navbar + Outlet
│   ├── ProtectedRoute.jsx      # Auth guard (redirect if not authenticated)
│   ├── BattleDetailModal.jsx   # Battle detail modal
│   └── ScheduledMatchEditModal.jsx  # Match edit modal
│
├── context/
│   └── AuthContext.jsx         # Context API for global session
│
├── lib/
│   └── supabaseClient.js       # Singleton: createClient(url, anonKey)
│
└── pages/admin/                # 32 administration pages
    ├── LoginAdmin.jsx
    ├── DashboardAdmin.jsx
    ├── PlayersList.jsx         # List of players
    ├── PlayerEdit.jsx          # Player editing
    ├── TeamsList.jsx           # List of teams
    ├── TeamEdit.jsx            # Team editing
    ├── BattlesHistory.jsx      # ⚠️ 1353 lines (fat component)
    ├── SeasonDailyPoints.jsx   # ⚠️ 583 lines (points calculation)
    ├── SeasonZoneRankings.jsx  # Drag & drop rankings
    ├── SeasonExtreme.jsx       # Extreme/Risky mode config
    └── ... (23 more pages)
```

### File Conventions
- **Pages**: `src/pages/admin/*.jsx` (PascalCase)
- **Components**: `src/components/*.jsx` (PascalCase)
- **Styles**: Tailwind classes inline, no CSS modules
- **Imports**: Relative paths (`../lib/supabaseClient`)

---

## 4. Database (PostgreSQL via Supabase)

### Schema Overview
- **35+ tables** organized in 7 domains
- **No complex triggers** (logic in app/cron)
- **No stored procedures** (logic in app)
- **Migrations**: Supabase CLI (`supabase/migrations/`)

### Domains and Key Tables

#### 4.1 Temporal Management
| Table | Description | Relationships |
|-------|-------------|-----------------|
| `era` | Long periods (e.g.: ERA 5) | 1:N with `season` |
| `season` | Seasons (e.g.: Season 12) | N:1 with `era`, 1:N with `season_zone` |
| `season_zone` | Zones within season | N:1 with `season`, 1:N with `season_zone_team` |

#### 4.2 Core Entities
| Table | Description | Keys |
|-------|-------------|------|
| `player` | Players (53 records) | `player_id` (UUID, PK) |
| `player_identity` | Clash Royale tags | `tag` (unique), FK `player_id` |
| `team` | Teams (6 records) | `team_id` (UUID, PK) |
| `season_zone_team_player` | Season assignments | FKs: `player_id`, `team_id`, `zone_id` |

#### 4.3 Battles
| Table | Description | Relationships |
|-------|-------------|-----------------|
| `battle` | Battles (1514 records) | `battle_id` (UUID, PK, deterministic) |
| `battle_round` | Duel rounds | N:1 with `battle` |
| `battle_round_player` | Player per round | N:1 with `battle_round`, N:1 with `player` |
| `card` | CR cards | `card_id` (INT, PK from Supercell API) |

**Deterministic Battle ID Logic**:
```python
md5(battleTime + battleType + gameMode + sorted_tags) → UUID
```

#### 4.4 Competitions
| Table | Description |
|-------|-------------|
| `competition` | Competition types (e.g.: Cup, League) |
| `competition_stage` | Stages (e.g.: Groups, Playoffs) |
| `competition_group` | Groups within stage |
| `scheduled_match` | Scheduled matches |
| `scheduled_match_result` | Results |

#### 4.5 Extreme/Risky Mode
| Table | Description |
|-------|-------------|
| `season_extreme_config` | Allowed cards per mode |
| `season_extreme_participant` | Players in Extreme mode, with dates |

**Deck Validation**: See `EXTREME_VALIDATION_README.md`

---

## 5. Current Code Patterns

### 5.1 Typical Page Pattern (Refactored)
```jsx
// src/pages/admin/PlayersList.jsx
import { usePlayers } from '../../hooks/usePlayers';

export default function PlayersList() {
  const { players, loading, error } = usePlayers();
  // ... filters and rendering ...
}
```

```js
// src/hooks/usePlayers.js
import { fetchPlayers } from '../services/playersService';
export function usePlayers() { /* ... */ }
```

```js
// src/services/playersService.js
import supabase from '../lib/supabaseClient';
export async function fetchPlayers() { /* ... */ }
```

**Validation Checklist:**
- [x] Fetch logic outside component
- [x] Dedicated service for data access
- [x] Custom hook for UI consumption
- [x] Unit and e2e tests present

### 5.2 Data Access
**Current Pattern (No Abstraction)**:
```jsx
const { data, error } = await supabase.from("table").select();
```

**Problems**:
- Strong coupling to Supabase
- No caching
- No retries
- No unified loading states
- Query logic duplicated in 30+ components

### 5.3 Error Handling
```jsx
if (error) {
  alert("Error: " + error.message); // ❌ Blocks UI
}
```

**Used 100+ times in code**

### 5.4 Loading State
```jsx
const [loading, setLoading] = useState(true);
setLoading(true);
await fetchData();
setLoading(false);
```

**Missing**:
- Skeleton loaders
- Visual error states
- Per-section loading

---

## 6. Special Features

### 6.1 Battle Validation (Extreme/Risky)
**Files**: `BattlesHistory.jsx`, `EXTREME_VALIDATION_README.md`

**Rules**:
- **Extreme**: All decks must use 100% allowed cards
- **Risky**: At least N valid decks (N = rounds - 1)

**Key Functions**:
```javascript
fetchPlayerExtremeConfig(playerId, battleDate)
validateDeck(deckCards, allowedCardIds)
```

**UI**: 🔥 icon with ✓/✗ on battle list

### 6.2 Rankings Drag & Drop
**File**: `SeasonZoneRankings.jsx`  
**Library**: `@dnd-kit/core`, `@dnd-kit/sortable`  
**DB Field**: `season_zone_team_player.ranking` (INTEGER)

### 6.3 Date Handling (Game Day Logic)
**Critical Rule**: Battles before 09:50 UTC belong to previous calendar day

```javascript
// BattlesHistory.jsx
function fmtDateTime(iso) {
  const gameTime = new Date(iso);
  gameTime.setUTCMinutes(gameTime.getUTCMinutes() - 590); // -9h 50min
  // ... format gameTime for display
}
```

**Affects**: Battle queries by date, daily points calculation

---

## 7. Identified Architectural Issues

### 7.1 Fat Components (Critical)
| File | Lines | Responsibilities |
|------|-------|------------------|
| `BattlesHistory.jsx` | 1353 | UI + Fetch + Calculation + Extreme Validation |
| `SeasonDailyPoints.jsx` | 583 | UI + Fetch + Penalty calculation |
| `ScheduledMatches.jsx` | ~900 | UI + Fetch + CRUD + Modal logic |

**Impact**:
- Impossible to unit test
- Hard to understand and maintain
- Logic duplication
- Unnecessary re-renders

### 7.2 No Type Safety
**Language**: Pure JavaScript, no TypeScript

**Real Problems**:
```javascript
match.result.points_a  // Does it exist? Is it a number? Runtime error if not
player.nick || player.name  // Redundancy due to lack of types
```

### 7.3 Direct Database Access
**Pattern in 32+ pages**:
```jsx
const { data } = await supabase.from("table").select(...);
```

**Missing**:
- Data layer / Repository pattern
- Global cache
- Optimistic updates
- Retry logic

### 7.4 Poor Error Handling
```jsx
alert("Error: " + error.message);
```

**Used 100+ times**. Missing:
- Toast notifications
- Error boundaries
- Error context
- Recovery actions

### 7.5 No Unit Tests
**Coverage**: 0%  
**Frameworks**: None installed

---

## 8. Dependencies and Build

### 8.1 package.json (summarized)
```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.89.0",
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "react-router-dom": "^7.11.0",
    "@dnd-kit/core": "^6.3.1",
    "lucide-react": "^0.562.0"
  },
  "devDependencies": {
    "vite": "^7.2.4",
    "tailwindcss": "^4.1.18",
    "eslint": "^9.39.1"
  }
}
```

### 8.2 Build Process
```bash
# Development
npm run dev        # Vite dev server (http://localhost:5173)

# Production
npm run build      # Vite build → dist/
npm run preview    # Preview of build

# Linting
npm run lint       # ESLint
```

**Bundler**: Vite (no special config)  
**Target**: ES2020+, modern browsers

---

## 9. Authentication and Security

### 9.1 Authentication Flow
```
1. User → /admin/login
2. Email + Password → supabase.auth.signInWithPassword()
3. Supabase returns JWT → Stored in localStorage
4. <ProtectedRoute> verifies session in AuthContext
5. If no session → redirect to /admin/login
```

### 9.2 AuthContext
```jsx
// src/context/AuthContext.jsx
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // getSession() + onAuthStateChange()
  }, []);

  return <AuthContext.Provider value={{ session, loading }}>
    {children}
  </AuthContext.Provider>;
}
```

### 9.3 Security (Issues)
- ⚠️ **RLS not implemented**: Tables accessible with `anon key`
- ⚠️ **No roles**: All admin users have full access
- ⚠️ **Service role key in cron**: Exposed if .env is committed
- ✅ **JWT expiration**: Handled by Supabase (1 hour default)

---

## 10. Deployment and Operations

### 10.1 Environments
| Environment | Frontend | Backend | Data |
|-------------|----------|---------|------|
| **Production** | ? (not documented) | Supabase Cloud | PostgreSQL (kivlwozjpijejrubapcw) |
| **Local** | Vite dev (5173) | Supabase local (Docker) | PostgreSQL local (54322) |

### 10.2 Local Setup (Docker)
```bash
# Supabase local stack
supabase start          # Start PostgreSQL + Studio + APIs
supabase status         # See URLs and ports
supabase db reset       # Apply migrations + seed

# Frontend
npm run dev             # http://localhost:5173

# Environment variables (.env.local)
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<local_anon_key>
```

### 10.3 Database Migrations
**Location**: `supabase/migrations/`

**Workflow**:
```bash
# Create migration
supabase migration new description_of_change

# Apply locally
supabase db reset

# Apply to production (⚠️ requires permission)
supabase db push
```

**⚠️ Important**: 
- Don't edit production directly via Studio SQL Editor
- Always create versioned SQL migration
- Test locally before push

---

## 11. Code Metrics

| Metric | Value |
|--------|-------|
| **Pages** | 32 admin pages |
| **Components** | ~10 (layout, modals, guards) |
| **Total lines** | ~15,000 (estimated) |
| **Largest file** | BattlesHistory.jsx (1353 lines) |
| **Average lines/page** | ~350 lines |
| **Supabase queries** | 100+ instances of `supabase.from()` |
| **alert() calls** | 100+ (error handling) |

---

## 12. Technical Improvements Roadmap

### 12.1 Short Term (1-2 sprints)
1. **Add TypeScript** → Start with new files (.tsx)
2. **Create Toast/Notification system** → Replace alert()
3. **Error Boundaries** → Catch render errors
4. **Extract custom hooks** → `useSupabaseQuery`, `useAuth`

### 12.2 Medium Term (1-2 months)
5. **Data Layer** → Create `services/` with repositories
6. **Split BattlesHistory.jsx** → Smaller components
7. **Implement RLS** → Row Level Security in Supabase
8. **Testing setup** → Vitest + React Testing Library

### 12.3 Long Term (3-6 months)
9. **Migrate to Server Components (Next.js)** → If SSR needed
10. **State Management** → Zustand or Tanstack Query if grows
11. **CI/CD Pipeline** → GitHub Actions + Vercel
12. **Monitoring** → Sentry for errors, Analytics

---

## 13. Useful Development Commands

```bash
# Start entire local stack
supabase start
npm run dev

# Check Supabase status
supabase status

# Access database logs
docker logs supabase_db_liga-admin

# Connect to local PostgreSQL
docker exec -it supabase_db_liga-admin psql -U postgres

# Sync data from production to local
supabase db dump --data-only -f supabase/seed.sql
supabase db reset

# Stop services
supabase stop
```

---

## 14. Git Workflow and Collaboration

### 14.1 Repository Structure

**Monorepo**: Single project with multiple applications

```
d:\LigaInterna\.git/
├── liga-admin/          # React SPA
├── cron/                # Python sync job
├── docs/                # Shared documentation
├── specs/               # Technical specifications
└── DEVELOPMENT_BACKLOG.md
```

### 14.2 Branch Strategy

**Main branch**: `main` (protected)

**Work branches**:
- `feature/<task-id>-<description>` - New features
- `fix/<task-id>-<description>` - Bug fixes
- `refactor/<task-id>-<description>` - Refactors
- `docs/<description>` - Documentation updates

**Example**:
```bash
git checkout -b feature/LA-P1-001-useSupabaseQuery-hook
# ... implement changes
git commit -m "feat(liga-admin): add useSupabaseQuery custom hook"
git push -u origin feature/LA-P1-001-useSupabaseQuery-hook
```

### 14.3 Conventional Commits

**Format**:
```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types**: `feat`, `fix`, `refactor`, `docs`, `style`, `test`, `chore`, `perf`

**Scopes**: `liga-admin`, `cron`, `docs`, `db`, `ci`

**Example**:
```bash
git commit -m "feat(liga-admin): add useSupabaseQuery custom hook

Implements LA-P1-001:
- Create src/hooks/useSupabaseQuery.js
- Migrate BattlesHistory.jsx to use hook
- Reduce component from 1353 to 1303 lines

Related: LA-P1-001"
```

### 14.4 Code Review Process

**Developer → Architect**:

1. Developer implements backlog task
2. Self-verifies with task commands
3. Updates relevant documentation
4. Commit + push to feature branch
5. Notifies Architect

**Architect reviews**:

6. Checkout feature branch
7. Run automated verifications
8. Review architecture, quality, tests, docs
9. **Approves** → Merge to main, mark task [DONE]
10. **Rejects** → Generate correction task (CR-*)

### 14.5 Documentation Updates

**Always update when**:
- Add new pattern/hook/abstraction → `TECHNICAL_ARCHITECTURE.md` section 5
- Modify file structure → `TECHNICAL_ARCHITECTURE.md` section 3
- Identify new issues → `specs/02-current-problems.md`
- Complete task → `DEVELOPMENT_BACKLOG.md` (mark [DONE])

**Include docs in same commit**:
```bash
git add src/hooks/useSupabaseQuery.js
git add liga-admin/docs/TECHNICAL_ARCHITECTURE.md  # ← Update
git commit -m "feat: add useSupabaseQuery hook (LA-P1-001)

Updated TECHNICAL_ARCHITECTURE.md section 5.1"
```

---

## 15. References and Documentation

### Existing Documentation Files
- [specs/01-architecture-overview.md](../../specs/01-architecture-overview.md) - General overview
- [specs/02-current-problems.md](../../specs/02-current-problems.md) - Anti-patterns and issues
- [specs/03-professional-comparison.md](../../specs/03-professional-comparison.md) - Best practices
- [specs/04-database-schema.md](../../specs/04-database-schema.md) - Complete schema
- [specs/05-database-migrations.md](../../specs/05-database-migrations.md) - Migration system
- [EXTREME_VALIDATION_README.md](../EXTREME_VALIDATION_README.md) - Extreme Mode feature
- [RANKINGS_README.md](../RANKINGS_README.md) - Rankings feature
- [.github/copilot-instructions.md](../../.github/copilot-instructions.md) - Guide for AI agents
- [.github/WORKFLOW.md](../../.github/WORKFLOW.md) - **Git Workflow and Code Review** (⭐ important)

### External Links
- [Supabase Docs](https://supabase.com/docs)
- [React Router 7](https://reactrouter.com)
- [Tailwind CSS 4](https://tailwindcss.com)
- [Clash Royale API](https://developer.clashroyale.com)

---

**Last updated**: 2026-01-24  
**Author**: Documentation generated by AI Agent (Architect)  
**Version**: 1.0
