# Tasks: Disable Extreme Configuration Per Season

## 1. Database Migration

- [ ] 1.1 Create Supabase migration: Add `is_extreme_config_disabled` boolean column to seasons table (default: false)
- [ ] 1.2 Update RLS policies to restrict updates to service_role/admin only

## 2. Extreme Configuration Admin UI

- [ ] 2.1 Add "Disable Extreme Configuration for Current Season" checkbox to Extreme Configuration page
- [ ] 2.2 Add helper text explaining what disabling does
- [ ] 2.3 Implement checkbox onChange handler to update `seasons.is_extreme_config_disabled`
- [ ] 2.4 Implement checkbox state loading on page mount to read current season setting
- [ ] 2.5 Add success/error toast notifications for checkbox toggle
- [ ] 2.6 Add logging for admin actions (toggle on/off with timestamp)

## 3. Battle History Integration

- [ ] 3.1 Add query to fetch current season's `is_extreme_config_disabled` flag in BattlesHistory component
- [ ] 3.2 Store flag in component state (`isExtremConfigDisabled` or similar)
- [ ] 3.3 Refactor battle rendering to conditionally call `isExtreme()` based on flag
- [ ] 3.4 Ensure extreme badges/annotations are hidden when flag is true
- [ ] 3.5 Ensure extreme deck count/filtering is hidden/disabled when flag is true

## 4. Real-Time Updates

- [ ] 4.1 Add Supabase subscription to seasons table in BattlesHistory component
- [ ] 4.2 Implement listener to detect changes to `is_extreme_config_disabled`
- [ ] 4.3 Trigger battle re-render when configuration flag changes
- [ ] 4.4 Clean up subscription on component unmount

## 5. Testing & Validation

- [ ] 5.1 Test: Verify checkbox saves and persists in database
- [ ] 5.2 Test: Verify battles show/hide extreme badges when toggled
- [ ] 5.3 Test: Verify non-admin users cannot toggle checkbox (403 access denied)
- [ ] 5.4 Test: Verify extreme config changes update battle history in real-time
- [ ] 5.5 Create Playwright E2E test for extreme config toggle workflow
- [ ] 5.6 Test: Verify rollback/migration doesn't break existing seasons

## 6. Documentation & Cleanup

- [ ] 6.1 Update admin guide documentation with extreme config toggle instructions
- [ ] 6.2 Add comment in code explaining the `is_extreme_config_disabled` flag
- [ ] 6.3 Update CHANGELOG.md with feature summary
- [ ] 6.4 Archive this OpenSpec change after implementation
