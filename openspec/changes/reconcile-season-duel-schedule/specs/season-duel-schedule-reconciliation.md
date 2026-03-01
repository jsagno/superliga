# Capability: Season Duel Schedule Reconciliation

## Overview
Ensure daily duel scheduling is complete and valid for each player assignment period during a season.

## Functional Requirements

### FR1 — Date Boundaries
- Use `season.duel_start_date` as the first scheduling date.
- Use `season.duel_end_date` as the last scheduling date for `CW_DAILY` generation.
- If `duel_start_date` or `duel_end_date` is null, fail fast with a user-facing validation error.
- If `duel_end_date < duel_start_date`, fail fast with a user-facing validation error.

### FR2 — Effective Player Window
For each assignment row in `season_zone_team_player`:
- Effective start = max(`duel_start_date`, `assignment.start_date`)
- Effective end = min(`duel_end_date`, `assignment.end_date`) where null `assignment.end_date` means `duel_end_date`.
- If effective start > effective end, no rows are expected for that assignment.

### FR3 — Create Missing Rows
For each day in the effective window, ensure there is one `scheduled_match` row with:
- `type = CW_DAILY`
- `player_a_id = assignment.player_id`
- `zone_id = assignment.zone_id`
- `season_id = active season`
- `scheduled_from` within that day
If missing, create it with current defaults (`stage`, `best_of`, `status=PENDING`, etc.).

### FR4 — Cancel Invalid Existing Rows
For existing `CW_DAILY` rows tied to an assignment/player:
- If the match day is outside the effective window, mark it canceled.
- Cancellation must be non-destructive (status update), preserving auditability.
- Already-linked/confirmed rows should be left unchanged unless explicit admin override is designed.

### FR5 — Idempotency
Running the action multiple times should converge to the same dataset:
- No duplicates created.
- Same invalid rows remain canceled.

### FR6 — Operation Summary
After reconciliation, return/show:
- `created_count`
- `skipped_existing_count`
- `canceled_count`
- `assignment_rows_processed`
- optional warnings (e.g., missing duel start date, invalid assignment ranges)

## BDD Scenarios

### Scenario 1: Create Missing Matches Within Valid Window
Given a season with `duel_start_date = 2026-03-01` and `duel_end_date = 2026-03-10`
And player assignment `start_date = 2026-03-03`, `end_date = 2026-03-06`
When admin runs reconciliation
Then scheduled matches are present for 2026-03-03..2026-03-06 only
And no extra rows are created outside those dates.

### Scenario 2: Cancel Rows Beyond Assignment End
Given a player assignment ended on `2026-03-06`
And existing pending `CW_DAILY` rows for `2026-03-07` and `2026-03-08`
When admin runs reconciliation
Then those rows are marked canceled.

### Scenario 3: Open-Ended Assignment
Given assignment `start_date = 2026-03-03`, `end_date = null`
When admin runs reconciliation
Then matches are created from `2026-03-03` to `duel_end_date`.

### Scenario 5: Duel End Date Shortens Window
Given a season with `duel_start_date = 2026-03-01` and `duel_end_date = 2026-03-20`
And an assignment active through `2026-03-31`
When admin runs reconciliation
Then no `CW_DAILY` rows are created after `2026-03-20`
And existing pending rows after `2026-03-20` are marked canceled.

### Scenario 4: Idempotent Re-run
Given reconciliation already ran successfully
When admin runs reconciliation again
Then `created_count = 0`
And no duplicate rows are inserted.

## Notes
- Implementation should reuse existing `generateDailyDuels` workflow and extend it into full reconciliation.
- Match-day comparisons must use date-safe normalization to avoid timezone drift.
- Season configuration flow must expose and persist `duel_end_date`.
