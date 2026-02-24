# Feature: Player Profiles

## Overview
Provide a detailed player view with recent battles and performance trends.

## Requirements

- The system SHALL show detailed player information on a dedicated page.
- The system SHALL display battle history (last 20 battles with results).
- The system SHALL show trophy trend over time (line chart).
- The system SHALL indicate participation in ongoing wars.
- The system SHALL link the player to the current clan.

## Scenarios

### Scenario: Player History Analysis
- GIVEN an admin clicks a player profile
- WHEN the profile loads
- THEN display player info (name, trophies, best, role)
- AND show last 20 battles in reverse chronological order
- AND render a trophy trend chart for the last 30 days
- AND calculate win rate from recent battles
- WHEN the admin scrolls
- THEN load older battles via pagination or infinite scroll

## Related Specs
- [Player Rankings](./player-rankings.md)
- [Search and Filter](./search-filter.md)
- [Data Model](../../architecture/data-model.md)
