# Specification: Season Extreme Config Toggle

## ADDED Requirements

### Requirement: Season admin can toggle extreme configuration on/off
The system SHALL allow admin users to enable or disable extreme configuration validation for the current season via a checkbox in the Extreme Configuration admin page.

#### Scenario: Admin accesses Extreme Configuration page
- **WHEN** admin navigates to /admin/extreme-config
- **THEN** page displays all extreme configuration settings and controls
- **AND** "Disable Extreme Configuration for Current Season" checkbox is visible

#### Scenario: Admin toggles extreme config off
- **WHEN** admin clicks the "Disable Extreme Configuration for Current Season" checkbox
- **THEN** checkbox becomes checked/disabled state persists
- **AND** `seasons.is_extreme_config_disabled` is updated to `true` for current season
- **AND** system logs admin action with timestamp and user ID

#### Scenario: Admin toggles extreme config on
- **WHEN** admin clicks the checkbox again to uncheck it
- **THEN** checkbox becomes unchecked/enabled state persists
- **AND** `seasons.is_extreme_config_disabled` is updated to `false` for current season
- **AND** system logs admin action with timestamp and user ID

### Requirement: Checkbox state reflects current season setting
The system SHALL display the checkbox state reflecting whether extreme configuration is currently disabled for the active season.

#### Scenario: Page loads with extreme config disabled
- **WHEN** admin loads Extreme Configuration page when season has `is_extreme_config_disabled = true`
- **THEN** checkbox displays as checked/disabled
- **AND** helper text shows "Extreme configuration is currently disabled for this season"

#### Scenario: Page loads with extreme config enabled
- **WHEN** admin loads Extreme Configuration page when season has `is_extreme_config_disabled = false`
- **THEN** checkbox displays as unchecked/enabled
- **AND** helper text shows "Extreme configuration is currently active for this season"

### Requirement: Only admin users can modify extreme configuration toggle
The system SHALL enforce that only users with admin role can toggle the extreme configuration setting.

#### Scenario: Non-admin user attempts to view toggle
- **WHEN** non-admin user navigates to /admin/extreme-config
- **THEN** user is redirected to home page or given 403 Forbidden
- **AND** no UI controls for toggling are visible

#### Scenario: RLS policy protects database updates
- **WHEN** non-admin user attempts to update `seasons.is_extreme_config_disabled` via API
- **THEN** Supabase RLS policy rejects the update
- **AND** error is logged for security audit
