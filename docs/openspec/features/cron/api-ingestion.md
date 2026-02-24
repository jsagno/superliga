# Feature: API Data Ingestion

## Overview
Fetch clan and player data from the Supercell Clash Royale API at scheduled intervals.

## Requirements

- The system SHALL fetch clan data every 30 minutes.
- The system SHALL fetch battle logs for clan members every 60 minutes.
- The system SHALL respect Supercell API rate limits (120 requests per minute).
- The system SHALL cache API responses to minimize redundant requests.

## Scenarios

### Scenario: Regular Sync Cycle (Ingestion)
- GIVEN the cron job executes on schedule
- WHEN the Clash API responds within timeout
- THEN fetch the clan members list
- AND fetch battle logs for each member

### Scenario: API Rate Limit Reached
- GIVEN the cron job receives a 429 rate limit response
- WHEN remaining requests are below the threshold
- THEN pause with exponential backoff
- AND wait for the rate limit window to reset
- AND resume from the last checkpoint

## Related Specs
- [Sync Operations](./sync-operations.md)
- [Error Handling](./error-handling.md)
- [Data Synchronization](./data-synchronization.md)
