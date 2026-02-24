# Feature: Sync Operations

## Overview
Operational configuration, caching, batching, logging, monitoring, and testing guidance.

## Configuration

API:
- Base URL: https://api.clashroyale.com/v1
- Rate limit: 120 requests per minute
- Timeout: 10 seconds
- Cache TTL: 30 minutes for clan data, 60 minutes for battle logs

Database:
- Batch size: 25
- Connection pool size: 10

Retry:
- Max attempts: 5
- Initial backoff: 1 second
- Max backoff: 300 seconds
- Backoff multiplier: 2

Alerts:
- Failure threshold: 50% of requests
- Alert email: ops@liga.local

## Cache Strategy

- Clan data: 30-minute TTL
- Battle logs: 60-minute TTL
- Storage: local JSON files, optional Redis
- Invalidation: TTL-based with optional manual override

## Batch Processing

- Process players in batches of 25
- Commit per batch for stability
- Store checkpoints after each batch

## Logging

- Log sync start and end
- Log records fetched and persisted
- Log errors with player and batch context

## Monitoring and Alerts

Track:
- Records synced (players, battles, snapshots)
- Sync duration
- API response times
- Retry counts
- Cache hit ratio
- Database insert latency

Alert if:
- Sync exceeds 5 minutes
- More than 50% API requests fail
- Database write latency exceeds 2 seconds
- Three consecutive sync failures
- Cache corruption is detected

## Testing Scenarios

Unit tests:
- Cache TTL expiry
- Retry backoff calculations
- Duplicate detection
- Batch boundary handling

Integration tests:
- Full sync cycle with test API key
- Error recovery paths
- Transaction rollback
- Concurrent run prevention

Load tests:
- Process 50+ clan members
- Handle 1000+ battles in one sync
- Cache performance under load

## Related Specs
- [API Data Ingestion](./api-ingestion.md)
- [Error Handling](./error-handling.md)
- [Performance](./performance.md)
