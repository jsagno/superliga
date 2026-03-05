# Specification: Graduated Penalty System

This specification defines the graduated penalty system for tracking consecutive missed matches and applying escalating penalties until player removal.

## ADDED Requirements

### Requirement: Track consecutive missed matches per player

The system SHALL track the number of consecutive dates where a player failed to complete a scheduled match within their active date range.

#### Scenario: First missed match
- **WHEN** a player has a scheduled match on a past date with no scheduled_match_result
- **AND** the player is active on that date (between start_date and end_date)
- **THEN** the system SHALL increment the player's consecutive miss counter to 1

#### Scenario: Reset counter on completed match
- **WHEN** a player has a scheduled_match_result for a date after one or more consecutive misses
- **THEN** the system SHALL reset the player's consecutive miss counter to 0

#### Scenario: Ignore dates before player start_date
- **WHEN** evaluating a date that is before the player's start_date
- **THEN** the system SHALL NOT count it as a miss for that player

#### Scenario: Ignore dates after player end_date
- **WHEN** evaluating a date that is after the player's end_date
- **THEN** the system SHALL NOT count it as a miss for that player

#### Scenario: Ignore future dates
- **WHEN** evaluating a date that is in the future
- **THEN** the system SHALL NOT count it as a miss regardless of result status

### Requirement: Apply graduated penalties for consecutive misses

The system SHALL apply escalating point penalties based on the number of consecutive missed matches.

#### Scenario: First consecutive miss - Penalty of -1
- **WHEN** a player misses their first consecutive scheduled match
- **THEN** the system SHALL assign -1 points for that date

#### Scenario: Second consecutive miss - Penalty of -2
- **WHEN** a player misses their second consecutive scheduled match
- **THEN** the system SHALL assign -2 points for that date

#### Scenario: Third consecutive miss - Penalty of -5
- **WHEN** a player misses their third consecutive scheduled match
- **THEN** the system SHALL assign -5 points for that date

#### Scenario: Fourth consecutive miss - Penalty of -10
- **WHEN** a player misses their fourth consecutive scheduled match
- **THEN** the system SHALL assign -10 points for that date

#### Scenario: Fifth and subsequent misses - No display
- **WHEN** a player misses five or more consecutive scheduled matches
- **THEN** penalties SHALL continue to apply but the player SHALL be removed from the grid display (see removal requirement)

### Requirement: Remove player from grid after fourth miss

The system SHALL remove players from the daily points grid display after they reach four consecutive missed matches.

#### Scenario: Player removed after four misses
- **WHEN** a player's consecutive miss counter reaches 4
- **THEN** the system SHALL exclude that player from the daily points grid entirely

#### Scenario: Player remains hidden even after later completion
- **WHEN** a removed player later completes a match (after the 4th miss)
- **THEN** the player SHALL remain excluded from the grid display
- **AND** the consecutive miss counter SHALL remain at 4 or higher

#### Scenario: Player visible with up to three misses
- **WHEN** a player has 3 or fewer consecutive misses
- **THEN** the player SHALL remain visible in the grid with penalty points displayed

### Requirement: Display penalty points distinctly

The system SHALL visually distinguish penalty points from earned points in the grid display.

#### Scenario: Negative point styling
- **WHEN** displaying a cell with penalty points (-1, -2, -5, or -10)
- **THEN** the cell SHALL use red background color and red text color

#### Scenario: Penalty font weight
- **WHEN** displaying penalty points in the grid
- **THEN** the points SHALL use bold font weight to emphasize the penalty

### Requirement: Update legend for penalty system

The system SHALL document the graduated penalty system in the grid's legend section.

#### Scenario: Legend includes penalty rules
- **WHEN** displaying the daily points grid
- **THEN** the legend SHALL include an explanation of consecutive miss penalties: "-1 (1st miss), -2 (2nd miss), -5 (3rd miss), -10 (4th miss)"

#### Scenario: Legend explains removal behavior
- **WHEN** displaying the legend
- **THEN** it SHALL state that players are removed from the grid after 4 consecutive misses

### Requirement: Calculate total points including penalties

The system SHALL include penalty points in each player's total score calculation.

#### Scenario: Total includes negative points
- **WHEN** calculating a player's total score
- **THEN** the system SHALL sum all earned points and all penalty points to produce the final total

#### Scenario: Total can be negative
- **WHEN** a player's penalty points exceed their earned points
- **THEN** the total score SHALL display as a negative number
