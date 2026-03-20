## ADDED Requirements

### Requirement: Dashboard pending cards MUST allow linking via battle panel
The dashboard SHALL open the battle-link panel when the user clicks `Vincular` on a linkable pending card.

#### Scenario: Open link panel from dashboard card
- **WHEN** the player is on dashboard and clicks `Vincular` for a linkable pending match
- **THEN** the app opens `VincularBatallaPanel` using that pending match as context

#### Scenario: Dashboard refreshes after successful link
- **WHEN** linking is confirmed in the panel from dashboard
- **THEN** the dashboard reloads pending data
- **AND** the linked match is removed or updated according to backend status

### Requirement: Batallas Pendientes cards MUST allow linking via battle panel
The pending battles page SHALL open the same link panel from each linkable pending card.

#### Scenario: Open link panel from pending battles page
- **WHEN** the player is on Batallas Pendientes and clicks `Vincular` for a linkable pending match
- **THEN** the app opens `VincularBatallaPanel` with that match context

#### Scenario: Pending list and counter refresh after successful link
- **WHEN** linking is confirmed in the panel from Batallas Pendientes
- **THEN** the page reloads the list and pending counter

### Requirement: Non-linkable pending cards MUST keep link action disabled
Pending cards marked as non-linkable SHALL not open the linking flow.

#### Scenario: Virtual pending does not open linking panel
- **WHEN** the pending card has `linkDisabled = true`
- **THEN** `Vincular` remains disabled
- **AND** no linking panel is opened

### Requirement: Link candidates MUST match configured competition mode
The candidate battles list for linking SHALL include only battles matching the `api_game_mode` configured for the selected `scheduled_match` in `season_competition_config`.

#### Scenario: Filter candidates by configured api_game_mode
- **GIVEN** a pending `scheduled_match` with (`season_id`, `competition_id`, `stage`)
- **AND** `season_competition_config` defines `api_game_mode = X` for that tuple
- **WHEN** the player opens `VincularBatallaPanel`
- **THEN** only battles with `battle.api_game_mode = X` are listed as candidates

### Requirement: Link candidates MUST be battles played between scheduled participants
The candidate battles list SHALL include only battles where both players in the pending `scheduled_match` participated.

#### Scenario: Filter candidates by scheduled participants
- **GIVEN** a pending `scheduled_match` with `player_a_id` and `player_b_id`
- **WHEN** the player opens `VincularBatallaPanel`
- **THEN** the list includes only battles where both players appear in `battle_round_player`
- **AND** battles not played against the scheduled rival are excluded

### Requirement: Candidate rows MUST show player names and computed result details
Each candidate row in `VincularBatallaPanel` SHALL display the same core matchup details shown in liga-admin cup-matches available battles.

#### Scenario: Candidate row displays both players and both scores
- **WHEN** the player opens `VincularBatallaPanel`
- **THEN** each candidate row shows both player nicknames/names (left and right)
- **AND** each row shows both computed scores (`scoreLeft` and `scoreRight`)
- **AND** the row keeps the result badge consistent with the displayed score

### Requirement: Impersonation linking MUST be writable only for super admin
When using "view as player" mode, linking operations SHALL be enabled only for super admin users.

#### Scenario: Super admin can link while impersonating
- **GIVEN** a user with `role` = `SUPER_ADMIN` or `SUPER_USER`
- **AND** impersonation mode is active
- **WHEN** the user selects candidate battles
- **THEN** `Vincular Batallas` remains enabled

#### Scenario: Non-super-admin impersonation remains read-only
- **GIVEN** impersonation mode is active
- **AND** the user is not super admin
- **THEN** the panel shows read-only mode
- **AND** linking confirmation is blocked

### Requirement: Admin cup-matches status filter MUST include LINKED
The `liga-admin` cup-matches screen SHALL allow filtering by `LINKED` status to surface scheduled matches that already have linked battles.

#### Scenario: Filter cup-matches by LINKED status
- **WHEN** an admin opens the cup-matches status filter
- **THEN** `LINKED` is available as a selectable status
- **AND** selecting `LINKED` shows rows with `scheduled_match.status = LINKED`

### Requirement: Jugador daily linked detection MUST recognize auto-link override state
The jugador app SHALL treat cron auto-linked daily duels as linked/resolved when scheduled match status is override state.

#### Scenario: Daily duel considered linked for OVERRIDDEN or OVERRIDEN
- **WHEN** evaluating whether the current daily duel is linked/pending
- **THEN** status `OVERRIDDEN` is treated as linked/resolved
- **AND** status `OVERRIDEN` is also treated as linked/resolved for compatibility

### Requirement: Jugador pending rival name MUST be enriched from linked battle data
For CW_DAILY scheduled matches without explicit `player_b_id`, jugador SHALL derive rival display name from linked battle round opponent data.

#### Scenario: Pending card shows rival name after battle is linked
- **GIVEN** a CW_DAILY pending row with `player_b_id` missing
- **AND** the row has at least one `scheduled_match_battle_link`
- **WHEN** jugador builds pending rows for dashboard or pending battles list
- **THEN** rival name is populated from linked `battle_round_player.opponent`
- **AND** the card does not show `Rival por confirmar` if opponent name/tag is available