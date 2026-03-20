## ADDED Requirements

### Requirement: Dashboard MUST compute wins and losses from linked daily duels
LIGA-JUGADOR SHALL compute dashboard `wins` and `losses` using all `scheduled_match` records of type `CW_DAILY` for the active player in season that have at least one related row in `scheduled_match_battle_link`.

#### Scenario: Linked daily duels are counted as evaluated matches
- **WHEN** a player has `CW_DAILY` matches with battle links
- **THEN** the dashboard stats calculation uses those linked daily matches as the source set for win/loss evaluation

### Requirement: Win classification MUST use points rule for daily duels
For each linked daily duel with `scheduled_match_result`, the system MUST classify the duel as a win when the player's points for that match are `4` or `3`; otherwise it MUST classify as a loss.

#### Scenario: Points 4 or 3 count as win
- **WHEN** a linked daily duel result gives the player `points_a` or `points_b` equal to `4` or `3`
- **THEN** the duel increments `wins` by one and does not increment `losses`

#### Scenario: Other point values count as loss
- **WHEN** a linked daily duel result gives the player points outside `{4, 3}`
- **THEN** the duel increments `losses` by one and does not increment `wins`

### Requirement: Win rate MUST derive from computed daily linked stats
The dashboard SHALL compute `winRate` as `round((wins / (wins + losses)) * 100)` from the linked-daily-derived counters. If `wins + losses` is zero, `winRate` MUST be `0`.

#### Scenario: Non-zero evaluated duels
- **WHEN** there is at least one evaluated linked daily duel
- **THEN** `winRate` is computed from linked-daily `wins` and `losses`

#### Scenario: No evaluated duels
- **WHEN** no linked daily duel has an evaluable result
- **THEN** `winRate` is `0` and both counters are `0`
