# Feature: Clan Overview

## Overview
Show high-level clan statistics and recent war outcomes at a glance.

## Requirements

- The system SHALL display current clan statistics (trophies, members, war record).
- The system SHALL show war status during active wars.
- The system SHALL display recent war results with opponent info.
- The system SHALL track member join and leave events.

## Scenarios

### Scenario: View Clan Standings
- GIVEN an admin opens the dashboard
- WHEN the overview panel loads
- THEN display clan trophies, member count, and war record
- AND display recent war results
- AND show member join/leave events

## Related Specs
- [War Dashboard](./war-dashboard.md)
- [Data Currency Indicator](./data-currency-indicator.md)
- [Data Model](../../architecture/data-model.md)
