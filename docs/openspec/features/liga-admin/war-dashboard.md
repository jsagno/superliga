# Feature: War Dashboard

## Overview
Provide live status of clan war progress and results.

## Requirements

- The system SHALL show active war collection day and war day status.
- The system SHALL display war participants and attack status.
- The system SHALL show final results with opponent comparison.
- The system SHALL track war win and loss streaks.

## Scenarios

### Scenario: Monitor War Progress
- GIVEN the clan is in an active war (warDay state)
- WHEN the admin opens the war dashboard
- THEN show all participants with attack status
- AND highlight remaining attacks
- AND show current crown counts vs opponent
- AND display time remaining for war
- WHEN attacks are completed
- THEN update status automatically (polling or WebSocket)

## Related Specs
- [Clan Overview](./clan-overview.md)
- [Dashboard Nonfunctional Requirements](./dashboard-nonfunctional.md)
- [Data Model](../../architecture/data-model.md)
