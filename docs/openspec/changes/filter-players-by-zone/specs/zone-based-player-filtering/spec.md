## ADDED Requirements

### Requirement: Player dropdown filters by selected zone
The system SHALL display only players assigned to the selected zone for the active season in the player dropdown when a zone is selected.

#### Scenario: Zone selected shows zone players only
- **WHEN** user selects a zone from the Zone dropdown
- **THEN** the Player dropdown shows only players assigned to that zone for the current season

#### Scenario: No zone shows all players
- **WHEN** no zone is selected (default state)
- **THEN** the Player dropdown shows all available players

#### Scenario: Zone with no players shows empty
- **WHEN** user selects a zone that has no players assigned
- **THEN** the Player dropdown is empty OR displays a message indicating no players in zone

### Requirement: Player data loads from zone team assignments
The system SHALL fetch player assignments for the selected zone from the season_zone_team_player table in Supabase.

#### Scenario: Fetch zone team players on zone change
- **WHEN** user changes the zone selection
- **THEN** system queries season_zone_team_player table for players in that zone

#### Scenario: Filter active players only
- **WHEN** fetching players for a zone
- **THEN** system includes only players with active assignment dates (start_date <= today <= end_date or start_date <= today and no end_date)

#### Scenario: Handle assignment query error
- **WHEN** zone team player query fails
- **THEN** system either shows all players or appropriate error message without crashing

### Requirement: Zone filter maintains existing behavior
The system SHALL preserve all existing filtering and battle searching functionality when zone-based player filtering is applied.

#### Scenario: Zone + player filter affects battle results
- **WHEN** user selects both a zone and a player
- **THEN** battles are filtered for that specific player (current behavior unchanged)

#### Scenario: Clearing zone resets player filter options
- **WHEN** user clears the zone selection
- **THEN** player dropdown shows all players again, but preserves selected player if still valid

#### Scenario: Team filtering unaffected
- **WHEN** zone-based player filtering is active
- **THEN** team dropdown behavior remains unchanged (continues to filter teams by zone)

### Requirement: Zone player filtering performance
The system SHALL fetch and filter zone player assignments efficiently without degrading page performance.

#### Scenario: Zone assignment query is efficient
- **WHEN** user selects a zone with many players
- **THEN** system displays filtered player list within acceptable time (< 1 second)

#### Scenario: Multiple zone changes don't cause lag
- **WHEN** user rapidly changes zone selection multiple times
- **THEN** system updates player dropdown list smoothly without noticeable delays

### Requirement: User interface clearly indicates zone filtering
The system SHALL provide clear visual indication that the player dropdown is filtered by the selected zone.

#### Scenario: Player dropdown label shows filtering status
- **WHEN** a zone is selected
- **THEN** player dropdown label or helper text indicates filtering is active OR the limited player list makes it obvious

#### Scenario: Deselecting zone shows unfiltered message
- **WHEN** user deselects the zone filter
- **THEN** player dropdown returns to showing all players (visual indication that filter is removed)

### Requirement: Zone filter works with other page filters
The system SHALL allow zone-based player filtering to work seamlessly with mode, date, and extreme/risky filters.

#### Scenario: Zone + mode filter
- **WHEN** user selects both a zone and a game mode
- **THEN** system shows battles for players in that zone with that mode

#### Scenario: Zone + date range filter
- **WHEN** user selects a zone and date range
- **THEN** system shows zone-filtered players and battles within that date range

#### Scenario: Zone + extreme filter
- **WHEN** user selects a zone and extreme/risky filter
- **THEN** system shows only extreme/risky battles for players in that zone

### Requirement: URL parameter persistence for zone filter
The system SHALL maintain zone filter selection in URL searchParams for browser navigation and sharing.

#### Scenario: Zone selection persists in URL
- **WHEN** user selects a zone
- **THEN** zoneId is added to URL searchParams and player dropdown updates

#### Scenario: Entering page with zone param filters players
- **WHEN** user navigates to battles-history page with zoneId in URL
- **THEN** system loads and applies zone filter to show only zone-filtered players

#### Scenario: Back button preserves zone filter
- **WHEN** user navigates away and returns with browser back button
- **THEN** zone filter and player dropdown state are restored

### Requirement: Player assignment dates are honored
The system SHALL only show players who have an active assignment in the zone during the current season.

#### Scenario: Player with start date in future not shown
- **WHEN** player assignment start_date is in the future
- **THEN** player is not shown in filtered player dropdown for that zone

#### Scenario: Player with end date in past not shown
- **WHEN** player assignment end_date is in the past
- **THEN** player is not shown in filtered player dropdown for that zone

#### Scenario: Player with active date range is shown
- **WHEN** player assignment has start_date <= today AND (end_date >= today OR no end_date)
- **THEN** player is included in filtered player dropdown

### Requirement: Database query optimization
The system SHALL use efficient Supabase queries to minimize data transfer and computation.

#### Scenario: Query fetches only needed columns
- **WHEN** fetching zone team player assignments
- **THEN** system queries only player_id, start_date, end_date columns (not entire row)

#### Scenario: Query filters by zone_id and date
- **WHEN** loading players for a zone
- **THEN** query includes WHERE zone_id = X AND start_date <= now filters to minimize client-side processing
