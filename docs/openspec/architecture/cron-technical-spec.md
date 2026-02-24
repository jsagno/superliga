# CRON Sync - Technical Architecture

## 1. Executive Summary

**Purpose**: Synchronize Clash Royale battle data into Supabase with quality-aware retries and operational telemetry.
**Type**: Python background sync process.
**Status**: Active.
**Primary output tables**: `battle`, `battle_round`, `battle_round_player`, `card`, `player_identity`, `job_run`.

## 2. Architecture

```
Supercell API
	/clans/{tag}/members
	/players/{tag}/battlelog
				|
				v
CRON Sync Worker
	- Fetch members/tags
	- Fetch battlelogs
	- Parse/validate payloads
	- Upsert battle artifacts
	- Mark quality + retry metadata
	- Log run metrics/errors
				|
				v
Supabase (PostgreSQL)
	- battle
	- battle_round
	- battle_round_player
	- player_identity / player freshness
	- card
	- job_run
```

## 3. Core Responsibilities

### 3.1 Ingestion
- Fetches tracked players from the configured source set.
- Pulls battlelogs and transforms payloads into normalized battle entities.
- Ensures duplicate-safe writes via deterministic IDs + table constraints.

### 3.2 Parsing
- Extracts round granularity for duel and multi-round modes.
- Produces per-round, per-player detail rows including deck/crown metadata.
- Preserves complete source payload in `battle.raw_payload`.

### 3.3 Data Quality Lifecycle
- Maintains `sync_status` in `battle`:
  - `OK`, `INCOMPLETE`, `REPAIR_QUEUED`, `REPAIRED`, `GIVE_UP`
- Uses `needs_refresh`, `refresh_attempts`, `last_refresh_at` to control retries.
- Writes structured diagnostics to `data_quality`.

### 3.4 Identity Freshness
- Resolves player tags against `player_identity`.
- Maintains temporal tag mapping (`valid_from`/`valid_to`) where applicable.
- Updates freshness markers such as `player.last_seen_at` when observed.

### 3.5 Operational Telemetry
- Logs each run with status/timings in `job_run`.
- Captures error categories and messages for troubleshooting.
- Exposes processing counts and retry state in logs.

## 4. Supabase Data Contract (Write Scope)

### Primary writes
- `battle`
- `battle_round`
- `battle_round_player`
- `card`
- `player_identity`
- `job_run`

### Referenced reads
- `player`
- `season_zone_team_player` (when participant-scoped filtering is applied)

### Non-goals for CRON
- CRON does not own season/team/fixture admin workflows.
- CRON does not finalize official match results (`scheduled_match_result`) directly.
- CRON does not mutate standings snapshots directly unless explicitly orchestrated by scoring pipelines.

## 5. Idempotency and Consistency Strategy

- Deterministic battle identity generation ensures stable upsert keys.
- Database unique/PK constraints are relied on as final duplicate guardrails.
- Writes are organized in bounded batches; partial failures are retried and logged.
- Repair queue semantics allow eventual completion for transiently incomplete payloads.

## 6. Error Handling Strategy

- Retry transient API/DB failures with exponential backoff.
- Isolate per-player/per-batch failures; avoid whole-run aborts when possible.
- Escalate unrecoverable records to `GIVE_UP` after configured retry cap.
- Persist failure context in logs and `job_run` metadata.

## 7. Performance and Scalability

- API calls are cache-aware to reduce external pressure.
- Database writes are batched to limit round trips.
- Parsing pipeline is designed for predictable, bounded memory use.
- Current runtime model is single-process; horizontal scaling requires locking/partition strategy.

## 8. Security Considerations

- Uses Supabase service-role key (must stay in environment variables).
- Uses Supercell token (must stay in environment variables).
- No secrets committed to repository or emitted in logs.
- Input payloads are treated as untrusted and validated before persistence.

## 9. Operational Runbook (High Level)

1. Start worker with configured environment.
2. Verify API reachability and credentials.
3. Execute ingestion cycle (fetch → parse → persist → repair pass).
4. Record run result in `job_run` and emit metrics logs.
5. Investigate repeated `INCOMPLETE`/`GIVE_UP` patterns through admin diagnostics.

## 10. Related Documents

- [architecture/data-model.md](./data-model.md)
- [architecture/system-overview.md](./system-overview.md)
- [specs/clash-sync-cron.md](../specs/clash-sync-cron.md)
- [products/cron.md](../products/cron.md)