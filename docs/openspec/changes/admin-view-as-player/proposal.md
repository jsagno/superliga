# Proposal: Admin View-as-Player Mode (Liga Jugador)

## Why

Liga administrators currently cannot validate the real player experience end-to-end without using a real player account.
This creates friction in QA and operations:

- Admins cannot quickly reproduce player-reported UI/data issues.
- Verification of season-specific visibility (pending battles, standings, dashboard cards) is slow.
- Support depends on screenshots/messages from players instead of direct inspection.

A controlled "view as player" mode allows an authorized admin to switch the entire liga-jugador session context to a selected player in the active season.

## What Changes

Introduce an admin-only impersonation/view mode in `liga-jugador` that:

1. Shows a player selector (dropdown) containing valid players for the selected season.
2. Switches the app context (all pages/services) to the selected player.
3. Clearly indicates impersonation state globally.
4. Allows exiting impersonation and returning to admin-self context.

This is a **read-only observation mode** for MVP.

## Scope

### In Scope (MVP)
- Admin eligibility check to access impersonation controls (`SUPER_USER` role only).
- Season-aware dropdown with valid players in season roster.
- Global context switch across liga-jugador pages.
- Clear visual banner/tag indicating current impersonated player.
- Exit action to stop impersonation.

### Out of Scope (MVP)
- Performing writes as impersonated player (linking, reporting, editing).
- Audit logging of impersonation start/stop events.
- Cross-season bulk testing tools.
- Time-travel snapshots.
- Delegated impersonation permissions by zone/team (future enhancement).

## Impact

- Product: `liga-jugador`
- Affected areas: auth context, top-level layout/header, service query context, season/player lookup APIs.
- Security: strict role checks and read-only guardrails required.

## Success Criteria

- Admin can switch to any valid player in selected season in <= 3 interactions.
- All major player pages render using impersonated player context.
- No write actions are allowed while impersonating (MVP).
