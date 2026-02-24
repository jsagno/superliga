# Feature: Player Rankings

## Overview
Display a ranked list of clan members based on current trophies and contribution metrics.

## Requirements

- The system SHALL display a ranked list of clan members sorted by current trophies (descending).
- The system SHALL show player name, trophies, best trophies, and role within the clan.
- The system SHALL calculate a contribution rating (battles participated, win rate).
- The system SHALL allow filtering by role (leader, co-leader, member, elder).

## Scenarios

### Scenario: View Ranked Players
- GIVEN an admin opens the dashboard
- WHEN the rankings panel loads
- THEN show a table sorted by trophies
- AND display name, trophies, best trophies, and role
- AND display contribution rating for each player

## Related Specs
- [Clan Overview](./clan-overview.md)
- [Player Profiles](./player-profiles.md)
- [Search and Filter](./search-filter.md)
- [Data Model](../../architecture/data-model.md)
