# Feature Spec: Admin View-as-Player (Liga Jugador)

**Product:** liga-jugador  
**Status:** Draft (proposed)  
**Type:** Admin support / diagnostics capability

---

## Description

Allow an authorized admin to switch the entire liga-jugador runtime view to a specific player who is valid for a selected season.

This feature is intended for troubleshooting and validation of the player experience. In MVP, impersonation is strictly read-only.

---

## Functional Requirements

### FR-VAP-01: Admin-only visibility
- The "View as player" control MUST be visible only to users with `app_user.role = 'SUPER_ADMIN'`.
- All other users MUST never see or access this control.

### FR-VAP-02: Season-scoped player dropdown
- The control MUST include a season selector (default active season).
- The player dropdown MUST list only valid players in the selected season roster.
- The dropdown SHOULD support search by player name/nick.

### FR-VAP-03: Global context switch
- On selecting a player and confirming, the app MUST switch effective identity context to that player.
- All player-facing pages/services MUST render based on `effectivePlayerId`.
- Context switch MUST apply without requiring re-login.

### FR-VAP-04: Persistent impersonation indicator
- While impersonating, the app MUST show a persistent global indicator:
  - selected player identity
  - selected season
  - clear "Exit view" action

### FR-VAP-05: Exit impersonation
- Admin MUST be able to stop impersonation at any time.
- On exit, app MUST restore original admin-linked context.

### FR-VAP-06: Read-only mode in MVP
- While impersonating, write actions MUST be disabled or blocked.
- Any attempted write MUST fail with clear user feedback.

### FR-VAP-07: Unauthorized protection
- If an unauthorized user attempts to invoke impersonation APIs, request MUST be rejected.
- UI MUST handle this with a safe error state.

---

## UX Notes

- Control can be a button, dropdown, or header panel; implementation is flexible.
- Recommended pattern:
  - `View as` trigger in header
  - modal/panel with season + player selector
  - confirmation action to start impersonation
- Visual mode distinction should be obvious (chip/banner color change).

---

## Data Requirements

### Sources
- `app_user` (role/permissions — `SUPER_ADMIN` required)
- `app_user_player` (actor mapping)
- `season` (active/selectable seasons)
- `season_zone_team_player` (valid players in season)
- `player` (display info)

---

## Acceptance Scenarios

### Scenario 1: Admin impersonates a player
- GIVEN an authenticated admin in liga-jugador
- AND a season with valid roster players
- WHEN admin selects season + player and confirms
- THEN the app displays that player's data across all pages
- AND a persistent "viewing as" indicator is visible

### Scenario 2: Non-admin access
- GIVEN an authenticated non-admin user
- WHEN user opens liga-jugador
- THEN no impersonation controls are visible
- AND impersonation API calls are rejected

### Scenario 3: Exit impersonation
- GIVEN admin is currently impersonating a player
- WHEN admin clicks "Exit view"
- THEN app returns to original context

### Scenario 4: Read-only enforcement
- GIVEN admin is impersonating a player
- WHEN admin triggers a write action
- THEN action is blocked
- AND UI explains that impersonation mode is read-only

---

## Non-Functional Requirements

- NFR-1: Context switch latency should be under 1.5 seconds for median roster sizes.
- NFR-2: Dropdown search should remain responsive for at least 200 players.

---

## Open Questions

1. Should admins be allowed to impersonate across all seasons or only active season by default?
2. Should this mode exist in liga-admin as well, or remain only in liga-jugador?
