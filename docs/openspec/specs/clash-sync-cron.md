# Clash API Sync Cron Job Specification

## Overview
This specification defines the requirements and behavior of the clash-sync cron job that periodically fetches data from Supercell's Clash Royale API and synchronizes it to Supabase.

## Vision
Create a reliable, efficient data pipeline that:
- Keeps player and clan statistics fresh in Supabase
- Respects API rate limits and caching
- Handles failures gracefully with retry logic
- Maintains historical data for trend analysis
- Provides clear logging for debugging and monitoring

## Requirements

### REQ-1: API Data Ingestion
- The system SHALL fetch clan data from Clash API every 30 minutes
- The system SHALL fetch battle logs for clan members every 60 minutes
- The system SHALL respect Supercell API rate limits (120 requests/minute)
- The system SHALL cache API responses to minimize redundant requests

### REQ-2: Data Synchronization
- The system SHALL upsert player records from API data
- The system SHALL create battle records for new battles since last sync
- The system SHALL update clan statistics
- The system SHALL link players to clans based on membership

### REQ-3: Historical Tracking
- The system SHALL create PlayerSnapshot records daily
- The system SHALL track trophy changes over time
- The system SHALL maintain war records with results
- The system SHALL allow ranking calculations from historical data

### REQ-4: Error Handling
- The system SHALL retry failed API requests up to 5 times with exponential backoff
- The system SHALL log all errors with context for debugging
- The system SHALL skip individual failed players without blocking entire sync
- The system SHALL send alerts if more than 50% of requests fail in a batch

### REQ-5: Performance
- The system SHALL complete full sync within 5 minutes
- The system SHALL process battles in batches of 25 or fewer
- The system SHALL use connection pooling for database queries

## Scenarios

### Scenario: Regular Sync Cycle (Happy Path)
- **GIVEN** cron job executes at scheduled time
- **WHEN** Clash API is healthy and responds within timeout
- **THEN** fetch clan members list
- **AND** fetch battle log for each member
- **AND** fetch war information if war is active
- **AND** upsert all players and battles to Supabase
- **AND** create daily snapshot
- **AND** log completion with record counts

### Scenario: API Rate Limit Reached
- **GIVEN** cron job hits rate limit (429 response)
- **WHEN** requests remaining are below threshold
- **THEN** pause processing with exponential backoff
- **AND** wait for rate limit window to reset
- **AND** resume from last checkpoint
- **AND** log rate limit encountered with retry parameters

### Scenario: Player Not Found
- **GIVEN** fetching battle log for a player
- **WHEN** player receives HTTP 404 (left clan or removed)
- **THEN** skip that player
- **AND** log the skip event
- **AND** continue processing remaining players
- **AND** mark player as inactive in next update cycle

### Scenario: Duplicate Battle Detection
- **GIVEN** battle already exists in database with same timestamp
- **WHEN** fetching battle logs
- **THEN** skip duplicate
- **AND** update battle record if outcome differs (resilience to API changes)
- **AND** do not create duplicate battle record

### Scenario: Partial Failure Recovery
- **GIVEN** database connection fails during batch insert
- **WHEN** retry threshold (3 attempts) not exceeded
- **THEN** wait and retry with fresh connection
- **AND** log retry attempt with backoff duration
- **AND** continue on next cycle if threshold exceeded
- **AND** alert ops team if affecting multiple sync cycles

### Scenario: War Period Tracking
- **GIVEN** clan is in war collection day (collectionDay state)
- **WHEN** cron job runs
- **THEN** do not yet fetch war results
- **WHEN** war transitions to warDay state
- **THEN** enable war battle tracking
- **WHEN** war ends (ended state)
- **THEN** finalize war record with results
- **AND** update war_wins/war_losses for clan

## Implementation Details

### Configuration
```yaml
API:
  base_url: https://api.clashroyale.com/v1
  rate_limit: 120  # requests per minute
  timeout: 10      # seconds
  cache_ttl_clan: 30  # minutes
  cache_ttl_battles: 60  # minutes

Database:
  batch_size: 25
  connection_pool_size: 10

Retry:
  max_attempts: 5
  initial_backoff: 1  # seconds
  max_backoff: 300    # seconds (5 minutes)
  backoff_multiplier: 2

Alerts:
  failure_threshold_percent: 50  # Alert if >50% failures
  email_on_alert: ops@liga.local
```

### Cache Strategy
- **Clan Data**: 30-minute TTL (cheap to fetch, changes infrequently)
- **Battle Logs**: 60-minute TTL (can be expensive, players post battles regularly)
- **Cache Storage**: Local filesystem JSON files + optional Redis
- **Cache Invalidation**: Manual trigger or automatic on TTL expiry

### Batch Processing
- Process players in batches of 25
- Each batch: fetch battles, validate, upsert to DB
- Commit transactions per batch (faster than single transaction)
- Store checkpoint after each successful batch

### Logging
```
[2025-02-17 14:30:00] INFO: Clash sync started
[2025-02-17 14:30:02] INFO: Fetched clan data: PUGCG80C (49 members)
[2025-02-17 14:30:45] INFO: Synced 234 battles for 47 players
[2025-02-17 14:30:52] WARN: Player #ABC123 not found, skipping
[2025-02-17 14:31:15] INFO: Created 47 daily snapshots
[2025-02-17 14:31:20] INFO: Clash sync completed in 80 seconds
```

## Monitoring & Alerts

### Metrics to Track
- Records synced (players, battles, snapshots)
- Sync duration
- API response times
- Retry count
- Cache hit ratio
- Database insert latency

### Alert Conditions
- Sync exceeds 5 minutes
- >50% API requests fail
- Database write latency >2 seconds
- Three consecutive sync failures
- Cache corruption detected

## Testing Scenarios

### Unit Tests
- Cache TTL expiry logic
- Retry backoff calculations
- Duplicate detection
- Batch processing boundaries

### Integration Tests
- Full sync cycle with test API key
- Error recovery paths
- Database transaction rollback
- Concurrent run prevention

### Load Tests
- Process all 50+ clan members
- Handle 1000+ battles in single sync
- Cache performance under load

## Related Specs
- [Data Models](./data-models.md) - Entity definitions and validation
- [Admin Dashboard](./admin-dashboard.md) - How synced data is consumed
