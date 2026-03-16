# Liga Jugador – Player Portal

The player-facing portal for the **LigaInterna** Clash Royale league system.
Players log in via magic link and can view their standings, manage pending battle
links, and review their complete battle history.

---

## Features

| Feature | Route | Description |
|---------|-------|-------------|
| Login | `/` | Magic-link email authentication |
| Dashboard | `/dashboard` | Season overview: standings card, pending battles summary |
| Tabla de Posiciones | `/tabla` | League standings grid for the active season |
| Tabla de Equipos | `/tabla/equipos` | Team/clan roster breakdown |
| Batallas Pendientes | `/batallas` | Countdown list of matches to play; link or report battles |
| Vincular Batalla | (panel) | Link a recent Clash Royale battle to a league match |
| Histórico de Batallas | `/historial` | Paginated battle history with type filters and stats badges |
| Battle Detail Modal | (overlay) | Round-by-round detail with card images and crown counts |

---

## Tech Stack

- **React 19** + Vite 7
- **Tailwind CSS 4** utility styling
- **React Router DOM 7** SPA routing
- **Supabase JS ^2.89** – database + auth
- **@dnd-kit** *(reserved for future drag interactions)*
- **Lucide React** icons
- **Playwright 1.51** E2E testing

---

## Getting Started

```bash
# 1. Install dependencies
cd packages/liga-jugador
npm install

# 2. Create environment file
cp .env.example .env.local     # then fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

# 3. Start dev server (http://localhost:5174)
npm run dev
```

### Required env vars

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon (public) key |

---

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start local dev server on `:5174` |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Serve built `dist/` on `:4173` |
| `npm run lint` | ESLint check |
| `npm run test:e2e` | Run Playwright E2E tests (requires dev server) |
| `npm run test:e2e:serve` | Build + serve + run E2E tests |

---

## Project Structure

```
packages/liga-jugador/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── BottomNav.jsx    # Bottom navigation bar
│   │   ├── BattleCard.jsx   # History list card
│   │   ├── BattleDetailModal.jsx  # Round-by-round battle detail
│   │   ├── PendingBattleCard.jsx  # Pending match card with countdown
│   │   └── VincularBatallaPanel.jsx  # Battle linking slide-up panel
│   ├── context/
│   │   └── PlayerAuthContext.jsx   # Auth state + player_id resolution
│   ├── pages/               # Route-level page components
│   │   ├── Login.jsx
│   │   ├── DashboardJugador.jsx
│   │   ├── BatallasPendientes.jsx
│   │   ├── HistorialBatallas.jsx
│   │   ├── TablaPosiciones.jsx
│   │   └── TablaEquipos.jsx
│   ├── services/            # Supabase data access
│   │   ├── battlesService.js
│   │   ├── dashboardService.js
│   │   ├── scheduledMatchesService.js
│   │   └── standingsService.js
│   ├── App.jsx              # Router + auth wrapper
│   ├── main.jsx
│   └── supabaseClient.js
├── tests/
│   └── e2e/                 # Playwright E2E test specs
├── DEPLOYMENT_CHECKLIST.md
├── playwright.config.js
├── vite.config.js
└── package.json
```

---

## E2E Testing

E2E tests use a bypass mechanism to avoid needing real Supabase during CI.
Set `VITE_E2E_AUTH_BYPASS=true` at build time and the tests inject localStorage
keys to simulate authentication and data scenarios.

```bash
# Run against local dev server
npm run test:e2e

# Build + serve + test (closer to production)
npm run test:e2e:serve

# Single spec
npx playwright test tests/e2e/historial-batallas.spec.js --config playwright.preview.config.js
```

---

## Authentication Flow

1. Player enters their registered email on the Login page.
2. Supabase sends a magic link.
3. Player clicks the link → Supabase auth session created.
4. `PlayerAuthContext` resolves: `auth.uid()` → `app_user` → `app_user_player` → `player_id`.
5. App redirects to `/dashboard`.

Only email addresses registered in `app_user` are granted access.

---

## Security

Row Level Security (RLS) is enabled. See
[shared/database/README.md](../../shared/database/README.md#-row-level-security-rls)
for policy details.

Players can **only** read and write data scoped to their own league matches.
