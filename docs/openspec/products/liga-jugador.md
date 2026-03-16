# Product: LIGA-JUGADOR (Player Portal)

**Product Type**: Web Application (SPA)
**Status**: Active Development
**Version**: 1.0
**Repository**: `packages/liga-jugador/`

---

## Purpose

LIGA-JUGADOR is the mobile-first portal used by tournament players to track their season progress, review standings, manage pending battles, and inspect personal battle history.

It complements LIGA-ADMIN by exposing a player-scoped experience with strict data access rules and no administrative capabilities.

---

## Scope

### Included
- Google OAuth sign-in and protected routes
- Player-scoped dashboard
- Bottom navigation for mobile-first interaction
- Individual standings and team standings views
- Pending scheduled matches and battle linking flow
- Battle history with detail modal and round/deck breakdown
- E2E bypass fixtures for deterministic testing

### Excluded
- Tournament configuration and season administration
- Team/zone management operations
- Global data export and bulk moderation tools

---

## Core Capabilities

1. Authentication and Identity
- Sign-in with Google through Supabase Auth
- Resolve authenticated user to `app_user` and `player_id`
- Restrict access when identity mapping is missing

2. Dashboard Experience
- Show active season context (zone, league, team)
- Display wins, losses, win-rate and ranking indicators
- Preview pending battles with fast navigation to full list

3. Pending Battles and Linking
- List player pending matches by type
- Open linking sheet and associate one or more unlinked battles
- Update pending state after successful link operation

4. Battle History and Details
- Filtered/paginated personal battle timeline
- Global stats summary by season
- Detail modal with rounds, crowns and decks

5. Mobile Navigation
- Fixed bottom navigation (`Inicio`, `Batallas`, `Tabla`, `Clan`)
- Safe-area compatible spacing to avoid content overlap

---

## Security Model

- Row Level Security is mandatory for all player-facing reads/writes.
- Policies are defined in migration:
  - `supabase/migrations/20260316000000_liga_jugador_rls.sql`
- Helper functions resolve current role and player identity from JWT `sub`.
- Access rules:
  - `PLAYER` can only access own scope (plus direct rivals where applicable)
  - `ADMIN` retains full access for liga-admin operational compatibility
  - `service_role` bypass remains available for backend jobs

Detailed policy matrix is documented in:
- `shared/database/README.md`

---

## Technology Stack

- React 19
- React Router 7
- Vite 7
- Tailwind CSS 4
- Supabase JS Client 2.x
- Playwright for E2E coverage

---

## Verification and Quality

- Unit/feature smoke through Vite build and ESLint
- E2E suites under `packages/liga-jugador/tests/e2e/`
- Integration suite validates cross-screen journeys, unauthorized access behavior, responsive breakpoints, and basic performance budget

---

## Key References

- Feature change artifacts: `docs/openspec/changes/liga-jugador/`
- Product implementation docs: `packages/liga-jugador/README.md`
- Deployment guidance: `packages/liga-jugador/DEPLOYMENT_CHECKLIST.md`
