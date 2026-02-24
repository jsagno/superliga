# Feature: Data Synchronization

## Overview
Synchronize player, clan, and battle data into Supabase with idempotent upserts.

## Requirements

- The system SHALL upsert player records from API data.
- The system SHALL create battle records for new battles since the last sync.
- The system SHALL update clan statistics.
- The system SHALL link players to clans based on membership.

## Scenarios

### Scenario: Regular Sync Cycle (Persistence)
- GIVEN the cron job runs successfully
- WHEN battles are parsed
- THEN upsert players and battles to Supabase
- AND update clan statistics
- AND link players to clans

### Scenario: Duplicate Battle Detection
- GIVEN a battle already exists in the database
- WHEN battle logs are fetched
- THEN skip the duplicate battle
- AND update the battle record if outcome differs

## Related Specs
- [API Data Ingestion](./api-ingestion.md)
- [Historical Tracking](./historical-tracking.md)
- [Data Model](../../architecture/data-model.md)
