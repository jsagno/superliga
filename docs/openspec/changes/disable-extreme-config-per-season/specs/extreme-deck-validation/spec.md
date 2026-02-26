# Specification Delta: Extreme Deck Validation

## MODIFIED Requirements

### Requirement: Extreme deck validation respects season disable flag
The system SHALL check if extreme configuration is disabled for the current season before validating deck composition against extreme/risky rules. When disabled, no extreme deck checks SHALL be performed.

#### Scenario: Season has extreme config enabled
- **WHEN** `is_extreme_config_disabled = false` for current season
- **AND** `isExtreme()` function is called for a battle
- **THEN** deck is validated against extreme/risky composition rules
- **AND** function returns true/false based on deck composition
- **AND** validation logic operates as previously defined

#### Scenario: Season has extreme config disabled
- **WHEN** `is_extreme_config_disabled = true` for current season
- **AND** `isExtreme()` caller checks the disable flag first
- **THEN** `isExtreme()` is NOT called
- **AND** battle is treated as non-extreme regardless of deck composition
- **AND** no extreme badge is displayed

#### Scenario: DisableFlag changes mid-session
- **WHEN** season's `is_extreme_config_disabled` is toggled by admin
- **THEN** next battle history render reads updated flag
- **AND** extreme validation behavior changes accordingly
- **AND** previously shown/hidden badges update to reflect new state

