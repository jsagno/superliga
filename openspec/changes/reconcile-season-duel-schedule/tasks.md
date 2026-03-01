# Tasks: Reconcile Season Duel Schedule

## Implementation Tasks

### Task Group 1 — Schema and Configuration
- [ ] **T1.1** Create migration to add `duel_end_date` (DATE) to `season` table.
- [ ] **T1.2** Add validation/constraint at app level: `duel_end_date >= duel_start_date`.
- [ ] **T1.3** Update season create/edit configuration UI to include `duel_end_date`.
- [ ] **T1.4** Ensure season queries/selects include `duel_end_date` wherever duel generation is triggered.

### Task Group 2 — Analysis and Guardrails
- [ ] **T1.1** Confirm canonical date fields:
  - season lower bound: `duel_start_date`
  - season upper bound: `duel_end_date`
  - assignment bounds: `start_date` / `end_date`
- [ ] **T1.2** Define cancel policy by status:
  - pending rows => cancel
  - linked/confirmed rows => keep (default for this change)
- [ ] **T1.3** Add fail-fast validation when `duel_start_date` or `duel_end_date` is null.

### Task Group 3 — Reconciliation Logic (`admin/seasons`)
- [ ] **T2.1** Refactor current generation method to compute effective windows with `duel_start_date` and `duel_end_date`.
- [ ] **T2.2** Keep create-missing behavior for all expected days in range.
- [ ] **T2.3** Add reconciliation pass to find out-of-range existing `CW_DAILY` rows and cancel them.
- [ ] **T2.4** Ensure idempotency for repeated runs.
- [ ] **T2.5** Return/emit operation summary counters (created/skipped/canceled/processed).

### Task Group 4 — UX and Safety
- [ ] **T3.1** Update admin confirmation text to mention both actions: create missing + cancel invalid.
- [ ] **T3.2** Show final result summary in a single clear alert/toast.
- [ ] **T3.3** Log warnings for malformed assignment rows (invalid ranges, missing dates).

### Task Group 5 — Test Coverage
- [ ] **T4.1** Add unit-level tests (or service tests) for window computation and date normalization.
- [ ] **T4.2** Add integration path tests for:
  - create missing rows
  - cancel out-of-range rows
  - idempotent rerun
- [ ] **T4.3** Add/extend Playwright admin flow evidence for reconciliation action.

### Task Group 6 — Documentation
- [ ] **T5.1** Update relevant OpenSpec feature docs for season duel generation behavior.
- [ ] **T5.2** Add changelog note when implementation lands.

## Git Standards for This Change
- [ ] **G1** Branch name: `feat/reconcile-season-duel-schedule`
- [ ] **G2** Conventional commit example:
  - `feat(liga-admin): reconcile scheduled CW_DAILY matches with assignment windows`
- [ ] **G3** PR title mirrors commit scope and references this change folder.
- [ ] **G4** PR includes:
  - implementation summary
  - risk/rollback note
  - test evidence (including one adjacent regression flow)

## Acceptance Criteria
- `season` includes `duel_end_date` and season configuration UI allows managing it.
- Running reconciliation in `admin/seasons` creates missing `CW_DAILY` rows from `duel_start_date` to `duel_end_date` for valid assignments.
- Existing out-of-range rows (especially beyond assignment `end_date`) are canceled, not deleted.
- Re-running reconciliation does not produce duplicates.
- Admin receives clear summary of created/skipped/canceled counts.
