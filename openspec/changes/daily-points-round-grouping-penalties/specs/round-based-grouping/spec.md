# Specification: Round-Based Grouping

This specification defines the round-based grouping capability for organizing daily match dates into tournament rounds with configurable round lengths and visual grouping.

## ADDED Requirements

### Requirement: Configure round length per season

The system SHALL allow administrators to configure the number of days per round for each season independently.

#### Scenario: Default round length
- **WHEN** a new season is created without specifying days_per_round
- **THEN** the system SHALL default to 4 days per round

#### Scenario: Custom round length
- **WHEN** an administrator sets days_per_round to 5 for a season
- **THEN** all rounds in that season SHALL contain 5 days each

#### Scenario: Round length validation
- **WHEN** an administrator attempts to set days_per_round to a value less than 1 or greater than 14
- **THEN** the system SHALL reject the value with a validation error

### Requirement: Calculate round boundaries

The system SHALL automatically calculate round boundaries based on the season's date range and configured days_per_round.

#### Scenario: Even division of days
- **WHEN** a season has 20 scheduled days and days_per_round is 4
- **THEN** the system SHALL create 5 complete rounds of 4 days each

#### Scenario: Uneven division of days
- **WHEN** a season has 22 scheduled days and days_per_round is 4
- **THEN** the system SHALL create 5 complete rounds plus 1 partial round with 2 days

#### Scenario: Respect player active dates
- **WHEN** calculating rounds for a specific player
- **THEN** the system SHALL only include dates between the player's start_date and end_date (inclusive)

### Requirement: Display round headers in grid

The system SHALL render visual round grouping headers above the daily date columns in the points summary grid.

#### Scenario: Round header labels
- **WHEN** displaying the daily points grid
- **THEN** each round SHALL display a header labeled "Ronda N" where N is the round number starting from 1

#### Scenario: Round header colspan
- **WHEN** rendering a round header for a round with 4 days
- **THEN** the header cell SHALL span exactly 4 columns using HTML colspan attribute

#### Scenario: Partial round header
- **WHEN** the final round contains fewer days than days_per_round
- **THEN** the header SHALL span only the actual number of days in that round

#### Scenario: Round header styling
- **WHEN** displaying round headers
- **THEN** headers SHALL be visually distinct from day headers using bold text and background color

### Requirement: Maintain grid responsiveness

The system SHALL ensure the round-grouped grid remains usable across different screen sizes.

#### Scenario: Horizontal scroll on small screens
- **WHEN** the grid width exceeds viewport width
- **THEN** the system SHALL enable horizontal scrolling while keeping player name and team columns fixed on the left

#### Scenario: Round headers scroll with content
- **WHEN** user scrolls the grid horizontally
- **THEN** round headers SHALL scroll with their corresponding day columns

### Requirement: Persist round configuration

The system SHALL store the days_per_round configuration in the season table and retrieve it for display calculations.

#### Scenario: Save round configuration
- **WHEN** an administrator saves a season with days_per_round set to 5
- **THEN** the system SHALL store the value 5 in the season.days_per_round column

#### Scenario: Retrieve round configuration
- **WHEN** loading the daily points summary for a season
- **THEN** the system SHALL query the season.days_per_round value and use it for all round calculations

#### Scenario: Backward compatibility
- **WHEN** loading a season created before days_per_round column exists
- **THEN** the system SHALL treat NULL values as the default value of 4 days per round
