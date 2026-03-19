## ADDED Requirements

### Requirement: Dashboard MUST show a virtual pending daily duel when player has not played today
LIGA-JUGADOR SHALL create an in-memory pending item for the active day of duels when no `CW_DAILY` record exists for the player on that day.

#### Scenario: Virtual pending appears for missing daily duel
- **WHEN** today is within the duel window (`duel_start_date` to `duel_end_date`)
- **AND** the player has no `CW_DAILY` scheduled match for the active day
- **THEN** the dashboard pending section includes a virtual `CW_DAILY` pending card
- **AND** no database insert is performed

### Requirement: Virtual pending daily duel MUST be non-linkable
Virtual daily duel pending entries SHALL be informational and SHALL NOT allow linking actions.

#### Scenario: Link action is disabled for virtual pending
- **WHEN** a virtual pending daily duel card is rendered
- **THEN** the `Vincular` action is disabled
- **AND** the UI communicates that the pending item is informational

### Requirement: Batallas Pendientes list and count MUST include the same virtual daily rule
The pending matches list/count services SHALL apply the same virtual daily duel rule used by dashboard summary.

#### Scenario: Pending list includes virtual daily in DAILY/ALL filters
- **WHEN** the player opens Batallas Pendientes with filter `ALL` or `DAILY`
- **AND** virtual daily conditions are satisfied
- **THEN** the virtual daily pending appears in the list and contributes to pending count

#### Scenario: Pending list excludes virtual daily in CUP filter
- **WHEN** the player opens Batallas Pendientes with filter `CUP`
- **THEN** the virtual daily pending is not included