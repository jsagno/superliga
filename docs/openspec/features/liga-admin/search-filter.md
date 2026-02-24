# Feature: Search and Filter

## Overview
Enable fast lookup and filtering across players and battles.

## Requirements

- The system SHALL filter players by name, tag, or role.
- The system SHALL sort by trophies, battles played, and win rate.
- The system SHALL filter battles by date range, player, and result type.
- The system SHALL provide quick search with autocomplete.

## Scenarios

### Scenario: Search and Filter Players
- GIVEN an admin types a search query
- WHEN the query matches player names or tags
- THEN show autocomplete suggestions (max 10)
- AND update the player list in real time
- WHEN the admin opens the filter panel
- THEN show filters for role, trophy range, and battles played
- AND apply filters to the player list
- WHEN filters are applied
- THEN show a filtered count badge

## Related Specs
- [Player Rankings](./player-rankings.md)
- [Player Profiles](./player-profiles.md)
- [Data Model](../../architecture/data-model.md)
