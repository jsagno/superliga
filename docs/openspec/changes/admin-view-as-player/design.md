# Design: Admin View-as-Player Mode

## Context

`liga-jugador` is a player-facing app. This feature introduces a controlled admin capability to inspect the player experience by switching runtime identity context to a target player.

Key design goal: **preserve security boundaries while enabling fast support/debug workflows**.

## User Flow

1. Admin signs in to `liga-jugador` with an authorized admin account.
2. Admin opens "View as" control in the app shell/header.
3. Admin selects:
   - Season (default: active season)
   - Player (dropdown filtered to valid season players)
4. App enters impersonation mode and refreshes data context globally.
5. Admin navigates pages as that player view.
6. Admin exits impersonation and returns to own context.

## Architecture

### 1) Identity Context Layer

Extend auth/session context with:

- `realUserId`: authenticated app user id (admin)
- `effectivePlayerId`: player id used by all liga-jugador services
- `isImpersonating`: boolean
- `impersonationTarget`: metadata (player_id, name, season_id)

Rules:
- If `isImpersonating = false`, `effectivePlayerId` is the user-linked player (normal behavior).
- If `isImpersonating = true`, `effectivePlayerId` is the selected target player.

### 2) Eligibility and Permissions

Admin-only access required.

Eligibility source options (choose one in implementation):
- `app_user.role = 'SUPER_ADMIN'` (required for impersonation)
- Explicit permission table/claim if role values differ.

### 3) Player Source for Dropdown

Dropdown entries come from season roster dataset (`season_zone_team_player`) joined to player profile.

Constraints:
- Show only players assigned to selected season.
- Exclude inactive/invalid entries if business rule requires.
- Searchable dropdown for large rosters.

### 4) Read-only Guardrails (MVP)

When `isImpersonating = true`:
- Disable or hide write actions in UI.
- Service layer enforces no write calls from impersonated context.
- If write endpoint is attempted, reject with explicit error.

## UX Requirements

- Persistent visual state (banner/chip): "Viewing as: <Player Name>".
- One-click exit action always visible.
- Confirmation prompt before entering impersonation.
- Empty-state handling when season has no valid players.

## Risks and Mitigations

- Risk: admin forgets they are impersonating.
  - Mitigation: persistent global indicator + distinct color state.
- Risk: accidental writes as impersonated player.
  - Mitigation: read-only mode at UI and service layer.
- Risk: privacy concerns.
  - Mitigation: strict role gating.

## Rollout Plan

1. Feature flag: `VITE_ENABLE_ADMIN_VIEW_AS_PLAYER`.
2. Internal admin-only release.
3. Collect support/QA feedback.
4. Expand with scoped permissions if needed.
