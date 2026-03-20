## 1. OpenSpec Artifacts

- [x] 1.1 Create proposal for false virtual daily pending fix.
- [x] 1.2 Create design for cutoff/status/link-based suppression.
- [x] 1.3 Add specs for pending consistency and timestamp parsing.

## 2. Implementation

- [x] 2.1 Normalize timestamp input for day-key cutoff utility.
- [x] 2.2 Normalize status in virtual pending decision path.
- [x] 2.3 Add linked battle_time current-day guard to suppress virtual pending.
- [x] 2.4 Reuse pending source in dashboard summary for consistency.

## 3. Validation

- [x] 3.1 Run `npm --prefix packages/liga-jugador run build`.
- [x] 3.2 Validate change with `openspec validate fix-jugador-virtual-daily-pending-false-positive`.
