# Proposal: Reconcile Scheduled Daily Duels with Season and Assignment Dates

## Rewritten Requirement
In `admin/seasons`, the duel generation process must reconcile `scheduled_match` (`CW_DAILY`) records using two date boundaries:
1. Season duel window: from `season.duel_start_date` through `season.duel_end_date`.
2. Player assignment window: from `season_zone_team_player.start_date` through `season_zone_team_player.end_date` (or open-ended when null).

When executed, the process must:
- Create every missing `scheduled_match` day for each eligible player within the effective overlap of those windows.
- Cancel (do not hard-delete) existing scheduled matches that fall outside the player’s valid assignment window (especially after assignment `end_date`).

## Why
Current duel generation in `SeasonsList.jsx` uses `season_start_at`/`season_end_at` and only inserts missing records. It does not support a dedicated duel cutoff date and does not reconcile old/invalid rows when assignments are shortened or closed, causing stale pending matches.

## What Changes
- Add new field `season.duel_end_date` (DATE) as the duel scheduling upper bound.
- Add `duel_end_date` to season configuration UI/forms so admins can manage duel start/end explicitly.
- Update duel generation logic in `admin/seasons` to use `duel_start_date` as lower bound.
- Update duel generation logic in `admin/seasons` to use `duel_end_date` as upper bound for CW_DAILY scheduling.
- Add reconciliation pass to mark invalid scheduled rows as canceled.
- Keep operation idempotent and safe to run multiple times.
- Expose clear operation summary (created/skipped/canceled).

## Impact
- **Frontend**: `packages/liga-admin/src/pages/admin/SeasonsList.jsx`
- **Frontend (Season Configuration)**: update season create/edit configuration to include `duel_end_date`.
- **Database**: add `duel_end_date` to `season` table via migration; continue using existing `scheduled_match` and `season_zone_team_player` tables for reconciliation.
- **Operations**: admin-triggered repair/reconciliation action from season management.

## Non-Goals
- No changes to battle linking/autolink logic.
- No retroactive score recalculation in this change.
- No deletion of historical matches (status transition only).
