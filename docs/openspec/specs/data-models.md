# Data Models Specification (Current Supabase)

## Overview
This specification defines the canonical data model currently implemented in Supabase for Liga Interna.

The model is centered on:
- season and zone organization,
- team/player roster composition,
- scheduled matches linked to parsed battles,
- ledger-based scoring and standings snapshots.

## Canonical Sources
- Primary schema reference: `public` schema in Supabase
- Architecture mirror: `docs/openspec/architecture/data-model.md`

## Requirements

### REQ-1: Season and Zone Topology
- The system SHALL represent competition cycles via `era -> season -> season_zone`.
- The system SHALL enforce ordered zones per season using unique `(season_id, zone_order)`.
- The system SHALL track season lifecycle status with `DRAFT | ACTIVE | CLOSED`.

### REQ-2: Team and Player Composition
- The system SHALL maintain canonical `team` and `player` entities.
- The system SHALL model zone assignments through `season_zone_team`.
- The system SHALL model roster membership through `season_zone_team_player`.
- The system SHALL enforce roster constraints for jersey, league, ranking seed, and date ranges.

### REQ-3: Identity and User Linking
- The system SHALL keep temporal player tags in `player_identity`.
- The system SHALL map authenticated users to domain players via `app_user` and `app_user_player`.
- The system SHALL restrict app roles to `PLAYER | ADMIN`.

### REQ-4: Scheduling and Official Results
- The system SHALL store fixtures in `scheduled_match`.
- The system SHALL support optional tournament metadata (`competition`, `competition_stage`, `competition_group`).
- The system SHALL store final decision records in `scheduled_match_result`.
- The system SHALL track state transitions with `PENDING | LINKED | CONFIRMED | OVERRIDDEN`.

### REQ-5: Battle Ingestion and Linking
- The system SHALL ingest raw battles in `battle` and parsed rounds in `battle_round` and `battle_round_player`.
- The system SHALL track sync quality/status for ingestion lifecycle.
- The system SHALL link battles to scheduled matches through `scheduled_match_battle_link`.
- The system SHALL enforce one official match usage per battle (`battle_id` unique in link table).

### REQ-6: Points and Standings
- The system SHALL persist scoring events in `points_ledger` as the source for points.
- The system SHALL enforce scope integrity (`PLAYER` xor `TEAM` target semantics).
- The system SHALL support reversal semantics with strict reversal-reference checks.
- The system SHALL persist materialized standings in:
  - `player_standings_snapshot`
  - `team_standings_snapshot`
  - `player_home_snapshot`

### REQ-7: Extreme Mode Support
- The system SHALL configure season extreme mode via `season_extreme_config`.
- The system SHALL track participants via `season_extreme_participant`.
- The system SHALL enforce participant type values `EXTREMER | RISKY` and valid date ranges.

### REQ-8: Operational and Derived Read Models
- The system SHALL keep job audit data in `job_run`.
- The system SHALL keep card reference data in `card`.
- The system SHALL expose derived read views for admin read patterns, including:
  - `active_extreme_participants`
  - `v_active_team_players`
  - `v_player_current_tag`
  - `v_player_points`
  - `v_player_standings_source`
  - `v_player_wl`
  - `v_season_zone_player`
  - `v_team_points`

## Scenarios

### Scenario: Build current zone roster
- **GIVEN** an active season and zone
- **WHEN** admin requests roster composition
- **THEN** return teams from `season_zone_team`
- **AND** players from `season_zone_team_player` with league/seed/captain metadata

### Scenario: Resolve scheduled match from battle evidence
- **GIVEN** a scheduled fixture in `scheduled_match`
- **WHEN** battle data is ingested and linked via `scheduled_match_battle_link`
- **THEN** the final score is persisted in `scheduled_match_result`
- **AND** fixture status progresses to a resolved state (`CONFIRMED` or `OVERRIDDEN`)

### Scenario: Recompute standings after point events
- **GIVEN** new `points_ledger` rows are created for a season-zone
- **WHEN** standings materialization runs
- **THEN** `player_standings_snapshot` and `team_standings_snapshot` are updated
- **AND** read views expose updated totals and rankings

## Validation Rules (Schema-Enforced)
- Role values: `PLAYER | ADMIN`
- Season/Competition status values: `DRAFT | ACTIVE | CLOSED`
- Match status values: `PENDING | LINKED | CONFIRMED | OVERRIDDEN`
- Match decision source values: `AUTO | ADMIN`
- Ledger scope values: `PLAYER | TEAM`
- Standings scope values: `ZONE | LEAGUE`
- Battle round side values: `TEAM | OPPONENT`
- Extreme participant values: `EXTREMER | RISKY`

## Integration Points

### CRON -> Supabase
- Writes: `battle`, `battle_round`, `battle_round_player`, `card`, `job_run`
- May update identity freshness (`player_identity`, `player.last_seen_at`)
- Produces inputs for linking and points attribution

### LIGA-ADMIN -> Supabase
- Reads from base tables and derived views
- Manages season/zone/team/player configuration and scheduling flows
- Applies manual outcomes/overrides that write `scheduled_match_result` and ledger-affecting workflows

## Related Documentation
- `docs/openspec/architecture/data-model.md` (authoritative schema-oriented architecture view)
- `docs/openspec/specs/admin-dashboard.md`
- `docs/openspec/specs/clash-sync-cron.md`