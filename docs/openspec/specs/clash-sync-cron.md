# Clash API Sync Cron Job Specification

## Overview
This specification defines requirements and behavior for the cron service that fetches Clash Royale data and synchronizes operational datasets into Supabase.

The current data-sync responsibility is centered on:
- battle ingestion and normalization,
- player tag identity freshness,
- operational observability and retry-safe processing,
- data quality signals consumed by admin workflows.

## Vision
Create a reliable ingestion pipeline that:
- Keeps battle and identity data fresh for Liga workflows
- Respects API limits and avoids duplicate processing
- Handles partial failures with deterministic retry semantics
- Produces auditable run logs and quality metadata

## Requirements

### REQ-1: Battle Ingestion
- The system SHALL fetch recent battle logs for tracked player tags.
- The system SHALL upsert `battle` records with raw payload and status metadata.
- The system SHALL maintain `battle_round` and `battle_round_player` parsed artifacts.
- The system SHALL prevent duplicate battle insertion using primary/unique constraints.

### REQ-2: Sync Quality and Repair State
- The system SHALL set and update `battle.sync_status` (`OK`, `INCOMPLETE`, `REPAIR_QUEUED`, `REPAIRED`, `GIVE_UP`).
- The system SHALL track `needs_refresh`, `refresh_attempts`, and `last_refresh_at`.
- The system SHALL persist quality diagnostics in `data_quality` for downstream observability.

### REQ-3: Identity Freshness
- The system SHALL maintain current player tag mapping via `player_identity`.
- The system SHALL preserve temporal history (`valid_from`, `valid_to`) for tag changes.
- The system SHALL update player freshness markers (e.g., `player.last_seen_at`) when relevant.

### REQ-4: Rate Limiting, Caching, and Retry
- The system SHALL enforce API rate-limit safe behavior.
- The system SHALL use local cache and conditional refresh to minimize redundant calls.
- The system SHALL retry transient failures with bounded exponential backoff.
- The system SHALL skip isolated failures without aborting the whole run.

### REQ-5: Operational Logging
- The system SHALL create run metadata in `job_run` for each execution.
- The system SHALL include status, timings, and error context in logs.
- The system SHALL expose enough diagnostics for admin-side troubleshooting.

### REQ-6: Idempotency and Safety
- The system SHALL be safe to re-run without creating data duplication.
- The system SHALL process in batches to control DB/API load.
- The system SHALL continue from checkpoints where feasible.

## Scenarios

### Scenario: Successful ingestion cycle
- **GIVEN** tracked players are available
- **WHEN** cron executes
- **THEN** battles are ingested into `battle`
- **AND** rounds are parsed into `battle_round` and `battle_round_player`
- **AND** job completion is recorded in `job_run`

### Scenario: Partial payload quality issue
- **GIVEN** an API payload is incomplete
- **WHEN** parser validates payload
- **THEN** battle is marked with `sync_status=INCOMPLETE`
- **AND** refresh metadata is updated for subsequent repair attempts

### Scenario: Duplicate battle encountered
- **GIVEN** the same battle appears in a later fetch window
- **WHEN** upsert executes
- **THEN** duplicate rows are not created
- **AND** existing row metadata may be updated if quality improves

### Scenario: Rate-limit pressure
- **GIVEN** request velocity approaches limit
- **WHEN** limiter threshold is reached
- **THEN** cron slows/paces requests and retries safely
- **AND** run remains resumable without full restart

### Scenario: Player no longer resolvable
- **GIVEN** a tracked tag returns not found
- **WHEN** fetch fails for that tag
- **THEN** cron records the failure and continues remaining players
- **AND** next cycle can reattempt based on policy

## Monitoring Signals
- Run duration and status (`job_run`)
- Count of processed players and battles
- Sync-status distribution (`OK` vs repair states)
- Retry volume and terminal failures
- Cache effectiveness and API latency

## Related Specs
- [Data Models](./data-models.md) - Canonical tables, constraints, and validation
- [Admin Dashboard](./admin-dashboard.md) - How operational data is surfaced to admins