# Feature: Historical Tracking

## Overview
Maintain historical records for ranking calculations and trend analysis.

## Requirements

- The system SHALL create PlayerSnapshot records daily.
- The system SHALL track trophy changes over time.
- The system SHALL maintain war records with results.
- The system SHALL allow ranking calculations from historical data.

## Scenarios

### Scenario: Daily Snapshot Creation
- GIVEN the cron job completes a successful sync
- WHEN the daily snapshot schedule is due
- THEN create PlayerSnapshot records for all active players

### Scenario: War Period Tracking
- GIVEN the clan is in collection day
- WHEN the cron job runs
- THEN do not finalize war results
- WHEN the clan transitions to war day
- THEN enable war battle tracking
- WHEN the war ends
- THEN finalize war records and update war wins and losses

## Related Specs
- [Data Synchronization](./data-synchronization.md)
- [War Dashboard](../liga-admin/war-dashboard.md)
- [Data Model](../../architecture/data-model.md)
