# Feature: Responsive Design

## Overview
Ensure the admin dashboard is usable across desktop, tablet, and mobile devices.

## Requirements

- The system SHALL work on desktop (1920px+), tablet (768px+), and mobile (320px+).
- The system SHALL adapt table views to smaller screens.
- The system SHALL prioritize essential information on mobile.

## Scenarios

### Scenario: Mobile Dashboard View
- GIVEN an admin opens the dashboard on a mobile device
- WHEN the dashboard loads
- THEN show clan overview in card format
- AND show a scrollable player list table (name, trophies, role)
- AND hide secondary columns (best trophies, contribution)
- WHEN the admin taps a player
- THEN navigate to a mobile-optimized profile view

## Related Specs
- [Player Rankings](./player-rankings.md)
- [Player Profiles](./player-profiles.md)
- [Dashboard Nonfunctional Requirements](./dashboard-nonfunctional.md)
