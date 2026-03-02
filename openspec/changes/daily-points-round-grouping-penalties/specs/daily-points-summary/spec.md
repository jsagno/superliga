# Specification: Daily Points Summary

This specification defines the daily points summary grid that displays player performance across scheduled match dates with round grouping and penalties.

## ADDED Requirements

### Requirement: Load points from scheduled_match_result

The system SHALL retrieve points directly from the scheduled_match_result table rather than calculating from battle data.

#### Scenario: Query scheduled matches with results
- **WHEN** loading daily points for a season
- **THEN** the system SHALL query scheduled_match table joined with scheduled_match_result to retrieve points_a for each match

#### Scenario: Match without result
- **WHEN** a scheduled match exists with no corresponding scheduled_match_result record
- **THEN** the system SHALL treat it as a missed match and apply penalty rules

#### Scenario: Match with zero points
- **WHEN** a scheduled_match_result exists with points_a = 0
- **THEN** the system SHALL display 0 points (not treat it as a miss)

### Requirement: Group matches by game date

The system SHALL group scheduled matches by their scheduled_from date using the season's battle cutoff configuration.

#### Scenario: Apply cutoff to match dates
- **WHEN** grouping matches by date
- **THEN** the system SHALL use getBattleDateKey() with the season's battle_cutoff_minutes to determine the game date

#### Scenario: Multiple matches per player per date
- **WHEN** a player has multiple scheduled matches with the same game date
- **THEN** the system SHALL sum the points from all scheduled_match_results for that date

### Requirement: Display grid with player rows and date columns

The system SHALL render a table with one row per player and one column per scheduled game date.

#### Scenario: Player row identification
- **WHEN** rendering a player row
- **THEN** the row SHALL display the player's jersey number, nickname, team logo, and team name

#### Scenario: Date column headers
- **WHEN** rendering date columns
- **THEN** each column header SHALL display the date in DD/MM format

#### Scenario: Round headers above dates
- **WHEN** rendering the grid with round grouping enabled
- **THEN** a round header row SHALL appear above the date headers with "Ronda N" labels spanning the appropriate number of day columns

### Requirement: Apply player active date filtering

The system SHALL only display dates and calculate penalties for dates when the player was active in the season.

#### Scenario: Player inactive before start_date
- **WHEN** rendering a date that is before a player's start_date
- **THEN** the cell SHALL display a dash (-) or be grayed out, not count toward penalties

#### Scenario: Player inactive after end_date
- **WHEN** rendering a date that is after a player's end_date
- **THEN** the cell SHALL display a dash (-) or be grayed out, not count toward penalties

#### Scenario: Player active on date
- **WHEN** rendering a date within the player's active range
- **THEN** the cell SHALL display earned points, penalty points, or 0 based on match results

### Requirement: Sort players by team and jersey number

The system SHALL organize the grid rows by team name alphabetically, then by jersey number within each team.

#### Scenario: Team alphabetical order
- **WHEN** displaying the grid
- **THEN** teams SHALL be ordered alphabetically by team name

#### Scenario: Jersey number order within team
- **WHEN** displaying players from the same team
- **THEN** players SHALL be ordered by jersey_no in ascending numeric order

### Requirement: Filter grid by player name, team, and zone

The system SHALL allow users to filter the displayed players using search and dropdown filters.

#### Scenario: Filter by player name
- **WHEN** user types text in the player search field
- **THEN** only players whose nickname contains the search text (case-insensitive) SHALL be displayed

#### Scenario: Filter by team
- **WHEN** user selects a team from the team dropdown
- **THEN** only players assigned to that team SHALL be displayed

#### Scenario: Filter by zone
- **WHEN** user selects a zone from the zone dropdown
- **THEN** only players assigned to that zone SHALL be displayed

#### Scenario: Combine filters
- **WHEN** multiple filters are active simultaneously
- **THEN** only players matching ALL filter criteria SHALL be displayed

### Requirement: Display total points per player

The system SHALL calculate and display a total points column for each player row.

#### Scenario: Sum all earned and penalty points
- **WHEN** calculating total points
- **THEN** the system SHALL sum points from all date cells including positive earned points and negative penalty points

#### Scenario: Total column placement
- **WHEN** rendering the grid
- **THEN** the total column SHALL be fixed on the right side of the scrollable area

#### Scenario: Total column styling
- **WHEN** displaying the total points
- **THEN** the column SHALL use bold font and a distinct background color to differentiate it from date columns

### Requirement: Provide visual legend for point types

The system SHALL display a legend explaining the color coding and point values.

#### Scenario: Legend shows point ranges
- **WHEN** displaying the grid
- **THEN** the legend SHALL include color swatches for: ≥5 points (green), 3-4 points (blue), 1-2 points (yellow), 0 points (gray), penalty points (red), and player inactive (light gray)

#### Scenario: Legend explains penalties
- **WHEN** displaying the legend
- **THEN** it SHALL include the graduated penalty system explanation and removal policy
