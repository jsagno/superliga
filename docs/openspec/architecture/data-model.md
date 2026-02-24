# Supabase Data Model (Current)

## Scope
This document reflects the **current live Supabase schema** for `public` as of **2026-02-24**.

- Migration baseline present in project: `20260124214801_remote_schema`
- Base tables: **29**
- Views: **8**
- Public table RLS: currently **disabled**

## Domain Map

### Identity & Access
- `app_user` (PK: `id`) — user profile linked to `auth.users.id`
  - Columns: `id`, `email`, `full_name`, `role`, `created_at`
  - `role` allowed: `PLAYER | ADMIN`
- `app_user_player` (PK: `user_id`) — maps app user to player
  - Columns: `user_id`, `player_id`, `linked_at`
  - FKs: `user_id -> app_user.id`, `player_id -> player.player_id`

### Core Competition Structure
- `era` (PK: `era_id`) — high-level cycle container
- `season` (PK: `season_id`) — season metadata and lifecycle
  - Columns: `era_id`, `description`, `status`, dates, timestamps
  - `status` allowed: `DRAFT | ACTIVE | CLOSED`
- `season_zone` (PK: `zone_id`) — zones within a season
  - Unique: `(season_id, zone_order)`
- `team` (PK: `team_id`) — team registry
  - Unique: `name`
- `player` (PK: `player_id`) — player registry
  - Columns: `name`, `nick`, `is_internal`, `last_seen_at`
  - Unique: `nick`
- `season_zone_team` (PK: `season_zone_team_id`) — team assignment to zone
  - Unique: `(zone_id, team_id)`, `(zone_id, team_order)`
- `season_zone_team_player` (PK: `season_zone_team_player_id`) — roster assignment
  - Unique: `(zone_id, player_id)`
  - Checks:
    - `jersey_no` between `1..8`
    - `league` in `A | B`
    - `ranking_seed >= 1`
    - valid date range when `start_date/end_date` provided

### Identity History & Read Snapshots
- `player_identity` (PK: `player_identity_id`) — historical tag mapping
  - Unique: `(player_tag, valid_to)`
- `player_home_snapshot` (PK: `season_id, zone_id, player_id`)
  - JSON payload column: `data`
- `player_standings_snapshot` (PK: `season_id, zone_id, scope, league, player_id`)
  - Columns: `position`, `points_total`, `wins`, `losses`, `ranking_seed`, `delta_position`
  - `scope` allowed: `ZONE | LEAGUE`
- `team_standings_snapshot` (PK: `season_id, zone_id, team_id`)

### Match Scheduling & Result Resolution
- `scheduled_match` (PK: `scheduled_match_id`)
  - Columns: season/zone refs, competition refs, players, window/deadline, score, status
  - `status` allowed: `PENDING | LINKED | CONFIRMED | OVERRIDDEN`
- `scheduled_match_result` (PK: `scheduled_match_id`) — final outcome record
  - `decided_by` allowed: `AUTO | ADMIN`
- `scheduled_match_battle_link` (PK: `scheduled_match_battle_link_id`) — battle assignment to match
  - Unique: `(scheduled_match_id, battle_id)` and `battle_id` (battle can only be used once)

### Battles & Parsing Artifacts
- `battle` (PK: `battle_id`) — raw/normalized battle ingestion record
  - Columns: battle metadata, quality flags, `raw_payload`
  - `sync_status` allowed: `OK | INCOMPLETE | REPAIR_QUEUED | REPAIRED | GIVE_UP`
- `battle_round` (PK: `battle_round_id`) — split rounds per battle
  - Unique: `(battle_id, round_no)`
- `battle_round_player` (PK: `battle_round_player_id`) — per player per round detail
  - Unique: `(battle_round_id, player_id)`
  - `side` allowed: `TEAM | OPPONENT`

### Points Engine
- `points_ledger` (PK: `points_ledger_id`) — immutable-style accounting events
  - Scope check: `PLAYER | TEAM`
  - Enforced entity/scope consistency:
    - `scope=PLAYER` ⇒ `player_id` required, `team_id` null
    - `scope=TEAM` ⇒ `team_id` required, `player_id` null
  - Reversal integrity check:
    - `is_reversal=false` ⇒ `reversed_ledger_id` null
    - `is_reversal=true` ⇒ `reversed_ledger_id` not null

### Cup/Stage Configuration
- `competition` (PK: `competition_id`) — tournament family
  - `status` allowed: `DRAFT | ACTIVE | CLOSED`
- `competition_stage` (PK: `competition_stage_id`) — ordered stage entries
  - Unique: `(competition_id, stage)`
  - `status` allowed: `DRAFT | ACTIVE | CLOSED`
- `competition_group` (PK: `competition_group_id`) — groups inside a stage
  - Unique: `(competition_stage_id, code)`
- `season_competition_config` (PK: `season_competition_config_id`) — season-stage battle config
  - Checks:
    - `best_of` in `3 | 5`
    - `stage` in `CUP_QUALY | CUP_GROUP | CUP_SEMI | CUP_FINAL`
  - Includes JSONB `points_schema`
- `season_competition_group_member` (PK: `competition_group_member_id`) — player membership per group
  - Unique: `(competition_group_id, player_id)`

### Extreme Mode
- `season_extreme_config` (PK: `season_extreme_config_id`) — extreme deck setup per season
  - Unique: `season_id`
  - JSONB: `extreme_deck_cards`
- `season_extreme_participant` (PK: `season_extreme_participant_id`) — participant assignment over time
  - Unique: `(season_id, player_id)`
  - `participant_type` allowed: `EXTREMER | RISKY`
  - Date validity: `end_date` null or `end_date >= start_date`

### Operational Metadata
- `job_run` (PK: `job_run_id`) — process execution audit trail
  - Columns: `job_name`, `status`, `started_at`, `finished_at`, `error_type`, `error_message`, `meta`
- `card` (PK: `card_id`) — Clash card reference + raw payload

## Referential Graph (FK Summary)

### Root entities
- `era`, `team`, `player`, `competition`, `battle`, `card`, `job_run`

### Main FK chains
- `season -> era`
- `season_zone -> season`
- `season_zone_team -> season_zone + team`
- `season_zone_team_player -> season_zone + team + player`
- `player_identity -> player`
- `app_user_player -> app_user + player`
- `scheduled_match -> season + season_zone + player(+player_b) + optional competition/stage/group`
- `scheduled_match_result -> scheduled_match`
- `scheduled_match_battle_link -> scheduled_match + battle + app_user (linked_by_*)`
- `battle_round -> battle`
- `battle_round_player -> battle_round + player`
- `points_ledger -> season + season_zone + optional player/team + optional app_user + optional self(reversal)`
- `player_home_snapshot -> season + season_zone + player`
- `player_standings_snapshot -> season + season_zone + player`
- `team_standings_snapshot -> season + season_zone + team`
- `competition_stage -> competition`
- `competition_group -> competition_stage`
- `season_competition_config -> season + competition`
- `season_competition_group_member -> competition_group + player + season`
- `season_extreme_config -> season`
- `season_extreme_participant -> season + team + player`

## Read Models (Views)
- `active_extreme_participants`
- `v_active_team_players`
- `v_player_current_tag`
- `v_player_points`
- `v_player_standings_source`
- `v_player_wl`
- `v_season_zone_player`
- `v_team_points`

## Notes for Implementation
- The legacy conceptual model (`Clan`, `War`, trophy-based player table) is **not** the current schema.
- Current model is season/zone/team/player centric, with ledger-based scoring and explicit match-to-battle linking.
- Use views above for standings/UI reads when possible; treat base tables as source of truth.