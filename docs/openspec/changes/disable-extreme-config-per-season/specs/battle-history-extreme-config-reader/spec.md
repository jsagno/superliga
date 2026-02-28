# Specification: Battle History Extreme Config Reader

## ADDED Requirements

### Requirement: Battle history reads season extreme configuration on load
The system SHALL read the current season's `is_extreme_config_disabled` flag on component mount and store it in component state.

#### Scenario: Battle history component mounts
- **WHEN** user navigates to /admin/battles/history
- **THEN** component queries current season's `is_extreme_config_disabled` flag
- **AND** flag value is stored in React state
- **AND** component proceeds to render battles

#### Scenario: Configuration query succeeds
- **WHEN** component queries `seasons` table for current season
- **THEN** `is_extreme_config_disabled` value is retrieved successfully
- **AND** state is updated with flag value
- **AND** component does not show error

#### Scenario: Configuration query fails (network error)
- **WHEN** query fails due to network error
- **THEN** component defaults to `is_extreme_config_disabled = false` (extreme enabled)
- **AND** battles display with extreme annotations if applicable
- **AND** error is logged for debugging

### Requirement: System conditionally applies extreme deck validation based on flag
The system SHALL check the `is_extreme_config_disabled` flag before applying extreme/risky deck checks to battles.

#### Scenario: Extreme config is enabled (flag = false)
- **WHEN** `is_extreme_config_disabled = false` for current season
- **THEN** battle cards call `isExtreme()` function for each battle
- **AND** battles with extreme/risky decks display extreme badge/annotation
- **AND** extreme deck count is calculated and displayed

#### Scenario: Extreme config is disabled (flag = true)
- **WHEN** `is_extreme_config_disabled = true` for current season
- **THEN** battle cards skip `isExtreme()` function call
- **AND** NO extreme badges/annotations are shown even if deck would qualify
- **AND** extreme deck count remains 0 or is hidden
- **AND** battle filtering by extreme status is not available

### Requirement: Configuration changes update battle history in real-time
The system SHALL refresh extreme annotation display when seasonal configuration is toggled by admin.

#### Scenario: Admin toggles extreme config while battle history is open
- **WHEN** admin toggles `is_extreme_config_disabled` on Extreme Configuration page
- **THEN** battle history component detects configuration change
- **AND** component updates `is_extreme_config_disabled` state
- **AND** battle annotations refresh to show/hide extreme badges
- **AND** user sees immediate visual update without page reload

#### Scenario: User navigates to battle history after config toggle
- **WHEN** user navigates to battle history after admin toggles extreme config
- **THEN** component queries current season flag on mount
- **AND** battles display with correct extreme annotation state
- **AND** reflects current configuration
