# Design: Season Duel Schedule Reconciliation with `duel_end_date`

## Overview
This change introduces a dedicated duel scheduling end date (`season.duel_end_date`) and extends the admin duel generation action to reconcile `CW_DAILY` `scheduled_match` rows.

## Goals
- Use duel-specific boundaries (`duel_start_date`..`duel_end_date`) instead of broad season boundaries.
- Ensure every eligible player/day inside the effective window has exactly one pending `CW_DAILY` row.
- Cancel stale rows outside the effective window without hard deletion.
- Keep the operation idempotent.

## Data Model

### Season
- Add `duel_end_date DATE` to `season`.
- App-level validation: `duel_start_date` and `duel_end_date` must both be present for duel generation.
- App-level validation: `duel_end_date >= duel_start_date`.

### Scheduled Match
- Reuse existing `scheduled_match` rows (`type='CW_DAILY'`).
- Cancellation policy:
  - `PENDING` rows outside window -> set to canceled status.
  - `LINKED` / `CONFIRMED` rows remain unchanged in this change.

## Effective Date Window
For each `season_zone_team_player` assignment:
- `effectiveStart = max(duel_start_date, assignment.start_date)`
- `assignmentEnd = assignment.end_date ?? duel_end_date`
- `effectiveEnd = min(duel_end_date, assignmentEnd)`

If `effectiveStart > effectiveEnd`, there are no expected rows for that assignment.

## Reconciliation Algorithm
1. Load season date boundaries (`duel_start_date`, `duel_end_date`).
2. Load assignments by zone (`player_id`, `start_date`, `end_date`).
3. For each assignment:
   - Generate expected day set in effective window.
   - Create missing daily rows (`PENDING`).
   - Find existing `CW_DAILY` rows for player+zone+season.
   - Cancel `PENDING` rows whose match day is outside effective window.
4. Emit summary counters:
   - `created_count`
   - `skipped_existing_count`
   - `canceled_count`
   - `assignment_rows_processed`

## UI/UX
- Season configuration screens must include `duel_end_date` input.
- Duel generation confirmation text must communicate both operations:
  - create missing
  - cancel invalid
- Final result UI must show created/skipped/canceled counts.

## Safety and Idempotency
- Duplicate prevention relies on existing per-day lookup before insert.
- Re-running the process converges to a stable dataset.
- Cancel operation is status-based, preserving historical/audit context.

## Testing Strategy
- Window calculation unit tests (including null end date and invalid ranges).
- Integration tests for:
  - missing row creation
  - out-of-range canceling
  - idempotent rerun
- Admin flow verification for season config and reconciliation action.
