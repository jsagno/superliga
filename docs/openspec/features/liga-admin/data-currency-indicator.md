# Feature: Data Currency Indicator

## Overview
Surface data freshness to administrators and allow manual refresh.

## Requirements

- The system SHALL display the last sync timestamp prominently.
- The system SHALL show data age (for example, "Updated 2 minutes ago").
- The system SHALL warn if data exceeds 2 hours old.
- The system SHALL provide a manual refresh button.

## Scenarios

### Scenario: Refresh Stale Data
- GIVEN the dashboard shows data older than 2 hours
- WHEN the admin views the dashboard
- THEN display a warning badge on the data age indicator
- WHEN the admin clicks refresh
- THEN trigger a manual sync endpoint
- AND show a loading spinner
- AND update all data and timestamp on success
- AND display an error message if sync fails

## Related Specs
- [Clan Overview](./clan-overview.md)
- [Dashboard Nonfunctional Requirements](./dashboard-nonfunctional.md)
- [CRON Battle Sync](../cron/battle-sync.md)
