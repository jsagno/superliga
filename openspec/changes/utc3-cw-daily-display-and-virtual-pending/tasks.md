## 1. OpenSpec and Shared Rules

- [x] 1.1 Confirm active-day rule for virtual daily pending (within duel window only).
- [x] 1.2 Define shared helper behavior for UTC-3 day key computation and dedup checks.

## 2. Liga-Admin Cup Matches UTC-3 Rendering

- [x] 2.1 Add UTC-3 display helper in `ScheduledMatches.jsx` for date text rendering.
- [x] 2.2 Apply UTC-3 display conversion only to rows where `type = CW_DAILY` and `stage = SW_Duel_1v1`.
- [x] 2.3 Keep relative deadline countdown logic unchanged.
- [ ] 2.4 Add/update tests for CW_DAILY UTC-3 rendering and non-daily unchanged behavior.

## 3. Liga-Jugador Virtual Daily Pending

- [x] 3.1 Extend active season query to include duel window bounds where needed.
- [x] 3.2 Implement virtual daily pending builder in dashboard service without DB writes.
- [x] 3.3 Implement same virtual daily pending + count behavior in scheduled matches service.
- [x] 3.4 Mark virtual pending entries as non-linkable metadata.
- [x] 3.5 Update `PendingBattleCard` to disable `Vincular` for virtual entries and show informational state.
- [ ] 3.6 Add/update tests for dashboard and pending list filters/count with virtual daily pending.

## 4. Validation

- [ ] 4.1 Run focused lint/tests for affected files in liga-admin and liga-jugador.
- [x] 4.2 Run builds for both packages and verify no regressions.
- [ ] 4.3 Manually verify sample timestamps (UTC source -> UTC-3 display) and virtual pending behavior.