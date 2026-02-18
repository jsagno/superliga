# Liga Admin - Copilot Instructions

## Project Overview
**Liga Admin** is a React SPA for managing a Clash Royale internal league. Built with React 19, Vite, Tailwind CSS 4, React Router 7, and Supabase (PostgreSQL).

## AI Agent Guidelines

### Verification Policy
**Always verify your changes automatically after implementation:**
- After creating/modifying files → read them back to confirm
- After database migrations → query tables to verify data
- After git operations → check status/log
- After running commands → verify output/exit codes
- Use Docker exec, SQL queries, or file reads as needed

### Permission Requirements
**Request explicit permission before:**
- **Git operations**: commits, pushes, branch creation/deletion, merges
- **Supabase operations**: migrations, schema changes, data dumps, db push to production
- **Delegating work**: assigning tasks to other AI agents (Developer, etc.)
- **Destructive actions**: deleting files, dropping tables, resetting databases
- **External API calls**: deployments, production changes

### Workflow Pattern
1. Understand the requirement
2. Plan the approach (explain to user)
3. Get permission for sensitive operations
4. Execute changes
5. **Automatically verify** the result
6. Report outcome with verification evidence

## Architecture

### Current State (Known Issues)
- **Fat Components**: Pages like `BattlesHistory.jsx` (1353 lines) and `SeasonDailyPoints.jsx` (583 lines) contain UI, business logic, and data access together
- **Direct DB Access**: Components query Supabase directly via `supabase.from()` - no data layer abstraction
- **No Type Safety**: JavaScript only, no TypeScript
- See [specs/02-current-problems.md](specs/02-current-problems.md) for comprehensive anti-patterns documentation

### Structure
```
src/
├── app/routes.jsx              # React Router 7 route definitions
├── components/
│   ├── AdminLayout.jsx         # Main layout with nav
│   └── ProtectedRoute.jsx      # Auth guard
├── context/AuthContext.jsx     # Session management via Supabase Auth
├── lib/supabaseClient.js       # Singleton Supabase client
└── pages/admin/*.jsx           # 32 admin pages (all components)
```

## Database

### Schema & Migrations
- **Database**: Supabase (PostgreSQL) with 35+ tables organized in 7 categories
- **Migrations**: Use Supabase CLI (`supabase/migrations/`) - see [specs/05-database-migrations.md](specs/05-database-migrations.md)
- **Schema**: See [specs/04-database-schema.md](specs/04-database-schema.md) for full ER diagram and table details
- **Deprecated**: Old scripts in `database/` are no longer used

### Key Tables
- **Core**: `era`, `season`, `season_zone`, `team`, `player`, `player_identity`
- **Competitions**: `competition`, `competition_stage`, `competition_group`, `scheduled_match`
- **Battles**: `battle`, `battle_round`, `battle_round_player`, `card`
- **Special Modes**: `season_extreme_config`, `season_extreme_participant`

### Creating Migrations
```bash
# Create new migration
supabase migration new descriptive_name

# Apply locally
supabase db reset

# Push to production
supabase db push
```

## Coding Patterns

### Data Access Pattern (Current)
Components fetch data directly in `useEffect`:
```jsx
// Example from BattlesHistory.jsx
useEffect(() => {
  const { data } = await supabase
    .from("battle")
    .select("*, battle_round(*)")
    .order("battle_time", { ascending: false });
  setBattles(data);
}, []);
```

### Error Handling (Current)
Uses `alert()` for errors (poor UX, needs improvement):
```jsx
const { data, error } = await supabase.from("table").select();
if (error) {
  alert("Error: " + error.message);
  return;
}
```

### State Management
- **Auth**: Context API via `AuthContext.jsx` for session
- **Local State**: `useState` for component state
- **Computed Data**: `useMemo` for derived values (heavily used in grid/table pages)

### Component Conventions
- All admin pages in `src/pages/admin/*.jsx`
- Dark theme: Tailwind classes like `bg-slate-950`, `text-slate-100`
- Navigation: `NavLink` from React Router with active state styling
- Loading states: Manual `loading` boolean with conditional rendering

## Special Features

### Battle Validation (Extreme/Risky Mode)
- Validates decks for players in Extreme/Risky modes during war duels
- See [EXTREME_VALIDATION_README.md](EXTREME_VALIDATION_README.md)
- Key functions: `fetchPlayerExtremeConfig()`, `validateDeck()`
- Visual indicators: 🔥 icon with ✓/✗ for validation status

### Rankings System
- Drag & drop for player rankings using `@dnd-kit/*` libraries
- See [RANKINGS_README.md](RANKINGS_README.md)
- Page: `SeasonZoneRankings.jsx`
- Field: `season_zone_team_player.ranking`

### Date Handling
- **Game Day Logic**: Battles before 09:50 UTC belong to the previous calendar day
- See `fmtDateTime()` and `sameDayRange()` in [BattlesHistory.jsx](src/pages/admin/BattlesHistory.jsx)
- Always adjust UTC time by -9h 50min for display

## Development Workflow

### Commands
```bash
npm run dev      # Start Vite dev server
npm run build    # Production build
npm run lint     # ESLint
npm run preview  # Preview production build
```

### Environment Variables
Required in `.env`:
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

### Authentication
- Email/password via Supabase Auth
- Session persisted automatically by Supabase client
- Protected routes use `ProtectedRoute` component
- Sign out via `supabase.auth.signOut()`

## When Adding New Features

1. **New Pages**: Add to `src/pages/admin/` and register in [routes.jsx](src/app/routes.jsx)
2. **Database Changes**: Create migration with `supabase migration new`, don't edit production directly
3. **Complex Queries**: Consider date adjustment for battles (09:50 UTC cutoff)
4. **Extreme Mode**: Check if feature affects battle validation rules
5. **Navigation**: Add `NavLink` to [AdminLayout.jsx](src/components/AdminLayout.jsx) if needed

## Future Improvements (Documented Issues)
- Refactor to service layer for data access
- Add TypeScript for type safety
- Replace `alert()` with toast/modal UI
- Extract business logic from components
- Add unit tests
- Implement proper error boundaries

See [specs/03-professional-comparison.md](specs/03-professional-comparison.md) for detailed refactoring guidance.
