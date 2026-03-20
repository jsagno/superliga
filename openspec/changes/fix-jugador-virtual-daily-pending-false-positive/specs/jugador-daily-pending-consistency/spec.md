## ADDED Requirements

### Requirement: Virtual daily pending MUST be suppressed when today's daily duel is already linked
LIGA-JUGADOR SHALL NOT inject a virtual `CW_DAILY` pending card when there is at least one linked daily battle whose `battle_time` belongs to the current battle-day key computed with season cutoff.

#### Scenario: Linked daily battle exists for current battle-day
- **WHEN** player has a `scheduled_match_battle_link` to a `CW_DAILY` match
- **AND** linked battle `battle_time` resolves to current battle-day key
- **THEN** virtual daily pending is not injected

### Requirement: Daily pending resolution MUST normalize status variants
LIGA-JUGADOR SHALL normalize `scheduled_match.status` before resolution checks, including typo/casing variants such as `OVERRIDEN` and `OVERRIDDEN`.

#### Scenario: OVERRIDEN status should count as resolved
- **WHEN** a daily match has status `OVERRIDEN` (or normalized equivalent)
- **THEN** pending virtual injection logic treats it as linked/resolved evidence

### Requirement: Battle-day key computation MUST support Postgres timestamp text format
The battle-day key utility SHALL correctly parse timestamp strings in the Postgres format `YYYY-MM-DD HH:mm:ss+00`.

#### Scenario: Timestamp with space separator
- **WHEN** day-key utility receives a timestamp with date/time separated by space
- **THEN** it computes a valid battle-day key using season cutoff
