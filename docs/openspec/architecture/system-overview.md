# System Overview

This document summarizes shared architecture patterns across CRON and LIGA-ADMIN based on the current Supabase schema.

## System Context

Liga Interna is a tournament management platform composed of:

- CRON (Python sync service) for Clash API ingestion and data-quality processing.
- Supabase (PostgreSQL + Auth + Storage) as the system of record.
- LIGA-ADMIN (React SPA) for administrative operations and reporting.

## High-Level Architecture

```
Supercell API
	/clans/{tag}/members
	/players/{tag}/battlelog
				|
				v
CRON (Python 3.10+)
	- fetches, parses, validates
	- writes battle + round artifacts
	- updates quality/retry metadata
				|
				v
Supabase (PostgreSQL)
	- season/zone/team/player topology
	- scheduling + result entities
	- points ledger + standings snapshots
	- battle ingestion artifacts
				|
				v
LIGA-ADMIN (React SPA)
	- season/zone operations
	- roster and fixture management
	- standings, points audit, data-quality monitoring
```

## Data Flow

1. CRON fetches tracked player battle logs from Supercell API.
2. CRON validates and parses payloads into `battle`, `battle_round`, and `battle_round_player`.
3. CRON marks quality states (`OK`, `INCOMPLETE`, `REPAIR_QUEUED`, `REPAIRED`, `GIVE_UP`) and retries as needed.
4. LIGA-ADMIN reads Supabase snapshots/views for standings and operations.
5. LIGA-ADMIN writes administrative state (season-zone-team setup, fixtures, official results).
6. Scoring workflows materialize standings from `points_ledger` into snapshot tables.

## Shared Architectural Patterns

### Single Source of Truth

- Supabase PostgreSQL is the authoritative source for operational and reporting data.
- Derived views support read-heavy screens while base tables remain canonical.

### Idempotent Ingestion

- Battle ingestion is deterministic and duplicate-safe at database constraint level.
- Retry/repair metadata enables safe reprocessing without uncontrolled duplication.

### Direct Supabase Access

- LIGA-ADMIN uses Supabase client access for reads/writes.
- CRON uses service-role access for ingestion and operational writes.
- No dedicated middle-tier API is required in the current architecture.

### Snapshot + Ledger Strategy

- `points_ledger` is the accounting source for scoring events.
- Standings tables (`player_standings_snapshot`, `team_standings_snapshot`) are read-optimized outputs.

## Core Data Domains

- Temporal topology: `era`, `season`, `season_zone`
- Organization: `team`, `player`, `season_zone_team`, `season_zone_team_player`
- Identity and access: `player_identity`, `app_user`, `app_user_player`
- Scheduling and outcomes: `scheduled_match`, `scheduled_match_result`, `scheduled_match_battle_link`
- Ingestion artifacts: `battle`, `battle_round`, `battle_round_player`, `card`, `job_run`
- Scoring and rankings: `points_ledger`, standings/home snapshots
- Extreme mode: `season_extreme_config`, `season_extreme_participant`

Reference: [architecture/data-model.md](./data-model.md).

## Security and Access

- CRON uses Supabase service-role credentials.
- LIGA-ADMIN uses authenticated client access.
- Public-table RLS is currently disabled and tracked as a security hardening gap.
- Secrets must be stored in environment variables, never committed.

## Observability and Reliability

- CRON produces run and error telemetry through logs and `job_run` records.
- Partial failures are isolated and retried; full-cycle continuation is prioritized.
- Admin views surface freshness and ingestion quality indicators for operational trust.

## Performance Targets

- CRON cycle latency: under 5 minutes for expected workload.
- LIGA-ADMIN initial load: under 2 seconds for key views.
- Search/filter interactions: under 200 ms.

## Known Constraints

- Supercell API rate limits and endpoint constraints.
- CRON remains single-process and depends on bounded batching.
- RLS hardening is pending for public schema tables.

## References

- [products/cron.md](../products/cron.md)
- [products/liga-admin.md](../products/liga-admin.md)
- [architecture/cron-technical-spec.md](./cron-technical-spec.md)
- [architecture/liga-admin-technical-spec.md](./liga-admin-technical-spec.md)
- [architecture/data-model.md](./data-model.md)