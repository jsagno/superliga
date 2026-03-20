## 1. OpenSpec Artifacts

- [x] 1.1 Create proposal for daily-links-based dashboard W/L and win rate.
- [x] 1.2 Create design defining data sources and points rule.
- [x] 1.3 Add spec for linked daily duel aggregation requirements.

## 2. Liga-Jugador Implementation

- [x] 2.1 Add dashboard service helper to collect linked `CW_DAILY` matches for player and season.
- [x] 2.2 Aggregate wins/losses from `scheduled_match_result` points using 4/3 as win.
- [x] 2.3 Integrate aggregation into `fetchPlayerStats` while preserving shape and fallback behavior.

## 3. Validation

- [x] 3.1 Build `packages/liga-jugador` to verify no regressions.
- [x] 3.2 Run `openspec validate jugador-dashboard-daily-links-wlr`.
