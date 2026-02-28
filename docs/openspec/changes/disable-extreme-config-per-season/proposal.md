# Proposal: Disable Extreme Configuration Per Season

## Why

The Extreme Configuration feature (checking for extreme/risky deck compositions) is season-dependent. Some seasons may not have extreme/risky participants, making the configuration checks unnecessary and confusing for that season. Currently, there's no way to disable extreme validation per-season, forcing an all-or-nothing approach. This proposal adds per-season toggle capability so admins can disable extreme configuration for seasons where it's not applicable.

## What Changes

- Add a "Disable Extreme Configuration" checkbox to the Extreme Configuration admin page
- Read this per-season configuration toggle before validating decks in battle-history
- Skip extreme/risky deck checks when the toggle is disabled for the current season
- When disabled, the battle history will show all battles without extreme/risky annotations

## Capabilities

### New Capabilities

- `season-extreme-config-toggle`: Ability to enable/disable extreme configuration validation per-season via admin UI checkbox
- `battle-history-extreme-config-reader`: Ability for battle-history to read season-specific extreme configuration and conditionally apply deck checks

### Modified Capabilities

- `extreme-deck-validation`: Now respects per-season disable flag (previously always active)

## Impact

- **Frontend**: Extreme Configuration page (add checkbox), Battle History page (conditional rendering)
- **Backend**: Supabase query to read season config, RLS policies for admin-only access
- **Database**: New column `is_extreme_config_disabled` in seasons table
- **APIs**: None (read-only from client)
- **User Experience**: Cleaner battle history for seasons without extreme participants
