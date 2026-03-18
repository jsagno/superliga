# Tasks: Admin View-as-Player Mode

## 1. Authorization and Context

- [x] 1.1 Add admin eligibility check in auth/session bootstrap.
- [x] 1.2 Extend player auth context with `effectivePlayerId`, `isImpersonating`, and target metadata.
- [x] 1.3 Add context actions: `startImpersonation(targetPlayer, seasonId)` and `stopImpersonation()`.

## 2. UI Controls

- [x] 2.1 Add global "View as" control in app shell/header (admin-only).
- [x] 2.2 Add season selector (default active season).
- [x] 2.3 Add searchable player dropdown populated from valid season roster.
- [x] 2.4 Add persistent impersonation indicator and exit action.
- [x] 2.5 Add enter-confirmation dialog.

## 3. Data and Service Wiring

- [x] 3.1 Update player-facing services to use `effectivePlayerId` instead of static auth-linked player id.
- [x] 3.2 Ensure all key pages re-fetch on impersonation change.
- [x] 3.3 Prevent write calls while impersonating (MVP read-only).

## 4. Security

- [x] 4.1 Add server-side validation for `SUPER_ADMIN` role on impersonation actions.
- [x] 4.2 Add negative-path handling for unauthorized access.

## 5. Testing

- [ ] 5.1 Unit tests for context state transitions.
- [x] 5.2 E2E: admin can impersonate a valid player in season.
- [x] 5.3 E2E: non-admin cannot access view-as controls.
- [x] 5.4 E2E: all major pages switch data context correctly.
- [x] 5.5 E2E: write attempts blocked in impersonation mode.
