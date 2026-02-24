# Admin Dashboard Specification

## Overview
This specification defines requirements and UX for the Liga Interna admin dashboard as a React/Vite frontend over Supabase.

The dashboard is organized around the current domain model:
- seasons and zones,
- teams and rostered players,
- scheduled matches and linked battles,
- ledger-based standings and snapshots.

## Vision
Create an intuitive, real-time admin interface that enables:
- Fast season and zone operations
- Clear visibility into team/player standings
- Reliable fixture management and result confirmation
- Data quality monitoring for battle ingestion and scoring
- Mobile-friendly management workflows

## Requirements

### REQ-1: Season and Zone Navigation
- The system SHALL let admins select active `season` and `season_zone` contexts.
- The system SHALL display season status (`DRAFT | ACTIVE | CLOSED`) and key dates.
- The system SHALL show zone ordering and team composition for the selected context.

### REQ-2: Team and Roster Management View
- The system SHALL display team list from `season_zone_team` ordered by `team_order`.
- The system SHALL display roster entries from `season_zone_team_player` including:
  - `league`, `ranking_seed`, `jersey_no`, `is_captain`
- The system SHALL support filtering players by team, league, and name/nick.

### REQ-3: Standings View
- The system SHALL display team standings from `team_standings_snapshot`.
- The system SHALL display player standings from `player_standings_snapshot`.
- The system SHALL show deltas (`delta_position`) and W/L metrics.
- The system SHALL support scope-based views (`ZONE`, `LEAGUE`).

### REQ-4: Match Operations
- The system SHALL display scheduled fixtures from `scheduled_match`.
- The system SHALL show status (`PENDING | LINKED | CONFIRMED | OVERRIDDEN`) and score fields.
- The system SHALL surface battle link status from `scheduled_match_battle_link`.
- The system SHALL support admin result workflows reflected in `scheduled_match_result`.

### REQ-5: Battle and Data Quality View
- The system SHALL expose battle ingestion status from `battle` (`sync_status`, refresh metadata).
- The system SHALL support drill-down into parsed rounds (`battle_round`, `battle_round_player`).
- The system SHALL display data age and latest update indicators for operational trust.

### REQ-6: Points Auditability
- The system SHALL display points events from `points_ledger` with source metadata.
- The system SHALL distinguish `PLAYER` vs `TEAM` scope entries.
- The system SHALL show reversal relationships when `is_reversal=true`.

### REQ-7: Extreme Mode Visibility
- The system SHALL display season extreme settings from `season_extreme_config`.
- The system SHALL display active participants from `active_extreme_participants`.

### REQ-8: Responsive UX
- The system SHALL work on desktop, tablet, and mobile.
- The system SHALL prioritize key status, standings, and fixture actions on smaller screens.

## Scenarios

### Scenario: View zone standings
- **GIVEN** admin selects an active season and zone
- **WHEN** dashboard loads standings
- **THEN** show team standings and player standings snapshots
- **AND** include wins, losses, points, and position deltas

### Scenario: Confirm fixture outcome
- **GIVEN** a fixture exists in `scheduled_match`
- **WHEN** linked battles are available
- **THEN** admin confirms outcome
- **AND** `scheduled_match_result` is persisted
- **AND** fixture status transitions to `CONFIRMED` (or `OVERRIDDEN` if forced)

### Scenario: Investigate ingestion inconsistency
- **GIVEN** a fixture appears unresolved
- **WHEN** admin opens battle details
- **THEN** show `battle.sync_status`, refresh attempts, and raw linkage evidence
- **AND** allow diagnosis of missing/invalid links without leaving dashboard

### Scenario: Review points attribution
- **GIVEN** standings changed unexpectedly
- **WHEN** admin opens points audit
- **THEN** show ordered `points_ledger` entries by source and timestamp
- **AND** expose reversal chains when applicable

## Data Refresh Strategy
- Real-time subscriptions preferred for standings and fixture state transitions
- Periodic refresh fallback for operational panels (battle ingestion and logs)
- Manual refresh available for admin troubleshooting flows

## Error Handling
- Show actionable messages for stale snapshots, missing links, and failed writes
- Preserve context (season, zone, fixture) in errors and retries
- Never block read-only dashboard views due to partial operational failures

## Related Specs
- [Data Models](./data-models.md) - Current entities and validation rules
- [Clash Sync Cron](./clash-sync-cron.md) - Battle ingestion and sync lifecycle