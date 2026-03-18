## Summary

Introduces the core scaffold and initial functional implementation of the player portal package (liga-jugador), including authentication flow, dashboard, standings, team standings, navigation shell, and baseline E2E coverage.

## Why

The repository contains a full implementation branch for liga-jugador with no PR currently open. This PR provides traceability, reviewability, and merge governance for that workstream.

## Scope

### New package and app setup
- Add packages/liga-jugador project scaffold and Vite/Tailwind/ESLint configuration.
- Add Supabase client setup and environment template.
- Add route structure and protected route handling.

### Authentication and access control
- Implement Google OAuth integration via auth service.
- Implement post-login authorization checks through app_user -> app_user_player linkage.
- Enforce redirect/sign-out behavior for unauthorized users.

### Player-facing screens and components
- Login page.
- Dashboard page with profile, seasonal progress, stats, and pending battle preview.
- Standings pages for players and teams.
- Bottom navigation and reusable standings/team row components.

### Data services
- Add services for authentication, dashboard data, and standings data retrieval.

### E2E tests
- Add initial E2E suite covering login, dashboard, navigation, standings, teams, and scaffold sanity.

## OpenSpec Alignment

- Change folder: docs/openspec/changes/liga-jugador
- Tasks status: sections 1, 2 (partial), 3, 4, 5, 6 marked complete; remaining sections are follow-up work.

## Files of Interest

- packages/liga-jugador/src/App.jsx
- packages/liga-jugador/src/context/PlayerAuthContext.jsx
- packages/liga-jugador/src/pages/DashboardJugador.jsx
- packages/liga-jugador/src/pages/TablaPosiciones.jsx
- packages/liga-jugador/src/pages/TablaEquipos.jsx
- packages/liga-jugador/src/services/dashboardService.js
- packages/liga-jugador/src/services/standingsService.js
- packages/liga-jugador/tests/e2e/dashboard.spec.js
- docs/openspec/changes/liga-jugador/tasks.md

## Testing Evidence To Attach In PR

- npm run liga-jugador:dev boot confirmation.
- Playwright run output for affected flows.
- Manual screenshots for key screens if CI artifacts are unavailable.

## Risks / Follow-ups

- Pending features remain for battle linking panel, history detail modal, and full RLS hardening tasks.
- Should be tracked as follow-up PRs against the same OpenSpec change.

## Checklist

- [ ] Verified local build for liga-jugador
- [ ] Verified E2E tests for implemented flows
- [ ] Attached Playwright evidence for primary and adjacent regression flow
- [ ] Confirmed no secrets committed
- [ ] Linked to OpenSpec change in PR description
