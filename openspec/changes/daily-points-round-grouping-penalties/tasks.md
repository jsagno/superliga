# Tasks: Daily Points Round Grouping and Penalties

## 1. Database Schema Changes

- [x] 1.1 Create migration file `20260125000000_add_days_per_round.sql`
- [x] 1.2 Add `days_per_round INT DEFAULT 4` column to season table
- [x] 1.3 Add constraint check `days_per_round BETWEEN 1 AND 14`
- [x] 1.4 Add column comment explaining purpose and default value
- [x] 1.5 Test migration rollback locally

## 2. Data Query Refactor (SeasonDailyPoints.jsx)

- [x] 2.1 Update scheduled_match query to remove linked_battles join
- [x] 2.2 Update query to select scheduled_from instead of battle_time
- [x] 2.3 Update query to select scheduled_match_result.points_a (keep existing nested structure)
- [x] 2.4 Remove all battle-related debug logging code
- [x] 2.5 Update date key generation to use `scheduled_from` with `getBattleDateKey()`
- [x] 2.6 Update season query to include `days_per_round` field
- [x] 2.7 Add fallback for missing days_per_round: `season.days_per_round ?? 4`

## 3. Round Calculation Logic

- [x] 3.1 Create `calculateRounds(dates, daysPerRound)` function
- [x] 3.2 Implement round grouping algorithm using date indices and modulo arithmetic
- [x] 3.3 Return array of round objects: `{ number, dates, startIndex, endIndex }`
- [x] 3.4 Add useMemo for rounds calculation (dependency: dates array, days_per_round)
- [x] 3.5 Handle partial final round correctly (fewer dates than daysPerRound)

## 4. Consecutive Miss Tracking

- [x] 4.1 Create `isPlayerActiveOnDate(player, dateStr)` helper (already exists, verify logic)
- [x] 4.2 Create `getPenaltyForConsecutiveMisses(missCount)` function returning -1, -2, -5, or -10
- [x] 4.3 Update gridData calculation to process dates sequentially per player
- [x] 4.4 Implement consecutive miss counter with reset on match completion
- [x] 4.5 Only count past dates (date <= today) for penalty calculation
- [x] 4.6 Only count dates within player's [start_date, end_date] range
- [x] 4.7 Create Set of excluded player IDs when miss count reaches 4
- [x] 4.8 Filter grid rows to exclude players in exclusion set
- [x] 4.9 Add metadata to playerDatePoints: `{ points, isPenalty, missCount }`

## 5. Grid Header Rendering

- [x] 5.1 Update table header structure to use nested `<tr>` rows
- [x] 5.2 Add round header row with `colSpan` for each round
- [x] 5.3 Label round headers as "Ronda {N}"
- [x] 5.4 Use `rowSpan={2}` for player/team/total columns
- [x] 5.5 Maintain existing date header row (DD/MM format)
- [x] 5.6 Add CSS class `round-header` with bold text and distinct background color
- [x] 5.7 Verify sticky positioning still works with nested headers

## 6. Grid Cell Rendering Updates

- [x] 6.1 Update cell rendering to check `isPenalty` flag
- [x] 6.2 Apply red background and red text color for penalty cells
- [x] 6.3 Display negative point values for penalties (-1, -2, -5, -10)
- [x] 6.4 Maintain existing color coding for earned points (green, blue, yellow, gray)
- [x] 6.5 Ensure inactive player dates (before start_date, after end_date) show dash or grayed out
- [x] 6.6 Verify total column includes both earned and penalty points

## 7. Legend Updates

- [x] 7.1 Add "Consecutive Miss Penalties" section to legend
- [x] 7.2 Document penalty values: "1st miss: -1, 2nd: -2, 3rd: -5, 4th: -10"
- [x] 7.3 Add note: "Players removed from grid after 4 consecutive misses"
- [x] 7.4 Add red color swatch for penalty cells
- [x] 7.5 Keep existing legend items (earned points color coding)

## 8. SeasonEdit Form Updates

- [x] 8.1 Add `days_per_round` field to season form in SeasonEdit.jsx
- [x] 8.2 Set field type to number input with min=1, max=14
- [x] 8.3 Set default value to 4 for new seasons
- [x] 8.4 Add field label: "Days per Round (for tournament grouping)"
- [x] 8.5 Add help text explaining purpose
- [x] 8.6 Include field in form submission and update queries
- [x] 8.7 Verify validation prevents values outside 1-14 range

## 9. Responsive Design & Performance

- [ ] 9.1 Test grid with 50+ dates (10+ rounds) - verify horizontal scroll works
- [ ] 9.2 Test grid with 200+ players - verify useMemo prevents unnecessary recalculations
- [ ] 9.3 Verify round headers scroll with date columns (not fixed)
- [ ] 9.4 Test on mobile/tablet screen sizes - ensure player columns remain fixed
- [x] 9.5 Profile render time with full dataset (should remain under 2 seconds)

**Note**: Comprehensive testing guide created: [RESPONSIVE_TESTING_GUIDE.md](../../packages/liga-admin/RESPONSIVE_TESTING_GUIDE.md)

## 10. Testing

- [x] 10.1 Write unit test for `calculateRounds()` function
- [x] 10.2 Write unit test for `getPenaltyForConsecutiveMisses()` function
- [x] 10.3 Write unit test for consecutive miss tracking logic
- [x] 10.4 Test edge case: player joins mid-season (penalties only after start_date)
- [x] 10.5 Test edge case: player leaves mid-season (penalties stop at end_date)
- [x] 10.6 Test edge case: partial final round with fewer than daysPerRound dates
- [x] 10.7 Test scenario: player with 3 misses then completes match (counter resets)
- [x] 10.8 Test scenario: player removed after 4 misses is excluded from grid
- [x] 10.9 Integration test: load season with real data, verify round headers render correctly
- [x] 10.10 Integration test: verify total column includes penalty points

## 11. Documentation

- [x] 11.1 Update code comments in SeasonDailyPoints.jsx explaining penalty logic
- [x] 11.2 Add JSDoc comments for new helper functions
- [x] 11.3 Update component README (if exists) documenting round grouping feature
- [x] 11.4 Verify business rules documentation in openspec/business-rules/scoring-system.md is accurate
- [x] 11.5 Add inline comment explaining consecutive miss algorithm with example

## 12. Deployment Preparation

- [x] 12.1 Run all existing tests to ensure no regressions
- [x] 12.2 Test migration on local database with existing season data
- [x] 12.3 Verify backward compatibility: existing seasons display with default 4-day rounds
- [x] 12.4 Create deployment checklist with rollback steps
- [x] 12.5 Prepare smoke test script for post-deployment verification

**Deliverables**:
- [DEPLOYMENT_CHECKLIST.md](../../packages/liga-admin/DEPLOYMENT_CHECKLIST.md)
- [smoke-test.js](../../packages/liga-admin/tools/smoke-test.js)
- [APPLY_MIGRATIONS_GUIDE.md](../../APPLY_MIGRATIONS_GUIDE.md)
