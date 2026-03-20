## ADDED Requirements

### Requirement: Cup Matches MUST display CW_DAILY duel windows in UTC-3
The Cup Matches view SHALL render `scheduled_from`, `scheduled_to`, and `deadline_at` in UTC-3 only when the row is `type = CW_DAILY` and `stage = SW_Duel_1v1`.

#### Scenario: CW_DAILY row shows UTC-3 converted dates
- **WHEN** an admin opens Cup Matches and a row has `type = CW_DAILY` and `stage = SW_Duel_1v1`
- **THEN** the visible dates for deadline and window are shown using UTC-3 conversion from stored UTC timestamps

#### Scenario: Remaining time stays based on original deadline instant
- **WHEN** an admin views the deadline badge for `CW_DAILY` + `SW_Duel_1v1`
- **THEN** the relative countdown uses the original timestamp instant
- **AND** only the rendered date text is UTC-3 formatted

### Requirement: Non-daily matches MUST preserve current display behavior
Rows that are not `CW_DAILY` + `SW_Duel_1v1` SHALL keep current date rendering behavior without UTC-3 override.

#### Scenario: CUP_MATCH row keeps existing formatting
- **WHEN** an admin views a `CUP_MATCH` row in Cup Matches
- **THEN** date/deadline rendering follows the existing formatting path without UTC-3 override