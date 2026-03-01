# Reconcile Season Duel Schedule

## Intent
Ensure `scheduled_match` records for season daily duels are reconciled against season duel dates and player assignment validity windows.

## Artifacts
- `proposal.md`
- `specs/season-duel-schedule-reconciliation.md`
- `tasks.md`

## Scope
- Admin action in Seasons area (`admin/seasons`)
- Create missing `CW_DAILY` matches from `season.duel_start_date` to `season_end_at`
- Cancel invalid already-created matches beyond player assignment `end_date`
