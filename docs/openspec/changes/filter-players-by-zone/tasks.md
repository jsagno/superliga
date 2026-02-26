## 1. Analyze Current Implementation

- [x] 1.1 Review BattlesHistory.jsx component structure
- [x] 1.2 Understand existing zone and team filtering implementation
- [x] 1.3 Identify where players array is used in dropdown
- [x] 1.4 Review current useEffect hooks for zone changes

## 2. Implement Player Filtering Logic

- [x] 2.1 Add zoneTeamPlayers state to BattlesHistory component
- [x] 2.2 Create useEffect hook to fetch zone team player assignments when zoneId changes
- [x] 2.3 Filter assignments to include only active players (start_date <= today <= end_date)
- [x] 2.4 Handle error cases in player assignment fetch (query failure, no players)
- [x] 2.5 Create useMemo hook to filter players based on zoneTeamPlayers array

## 3. Update UI Components

- [x] 3.1 Update player dropdown to use filtered players when zone is selected
- [x] 3.2 Maintain showing all players when zone is not selected
- [x] 3.3 Add visual indication that player list is filtered by zone
- [x] 3.4 Handle empty player list for zone with no assignments

## 4. Test Manual Scenarios

- [ ] 4.1 Test: Select zone → verify player dropdown shows only zone players
- [ ] 4.2 Test: Clear zone → verify player dropdown shows all players
- [ ] 4.3 Test: Select zone with no players → verify appropriate handling
- [ ] 4.4 Test: Zone + player selection → verify battle filtering still works
- [ ] 4.5 Test: Zone + team selection → verify team dropdown unchanged
- [ ] 4.6 Test: Zone + mode filter → verify battles show correct zone-filtered players
- [ ] 4.7 Test: Zone + date range → verify date filtering works with zone
- [ ] 4.8 Test: Zone filter persists in URL → verify zoneId in searchParams
- [ ] 4.9 Test: Browser back button → verify zone filter state restored

## 5. Performance and Optimization

- [ ] 5.1 Verify zone player query completes in < 1 second
- [ ] 5.2 Test rapid zone changes → verify no lag or stale UI
- [ ] 5.3 Check React render performance with large player lists
- [ ] 5.4 Verify useMemo optimization prevents unnecessary filtering on every render

## 6. Edge Cases and Error Handling

- [ ] 6.1 Handle case: Zone with no players assigned
- [ ] 6.2 Handle case: Database query error on zone change
- [ ] 6.3 Handle case: Supabase connection temporarily lost
- [ ] 6.4 Handle case: User has invalid zoneId in URL parameter
- [ ] 6.5 Handle case: Active season changes or is null
- [ ] 6.6 Test: Player with future start_date not shown
- [ ] 6.7 Test: Player with past end_date not shown
- [ ] 6.8 Test: Player with ongoing assignment is shown

## 7. Integration Testing

- [ ] 7.1 Verify existing battle filtering logic unchanged
- [ ] 7.2 Verify team dropdown still filters by zone correctly
- [ ] 7.3 Verify mode filter works with zone-filtered players
- [ ] 7.4 Verify extreme/risky filter works with zone-filtered players
- [ ] 7.5 Verify pagination works with zone filters applied
- [ ] 7.6 Verify expansion/collapsing battles works correctly

## 8. Code Quality

- [ ] 8.1 Ensure code follows React best practices
- [ ] 8.2 Verify proper dependency arrays in useEffect hooks
- [ ] 8.3 Check for console errors or warnings
- [ ] 8.4 Verify proper error handling with try-catch
- [ ] 8.5 Ensure code is readable and maintainable
- [ ] 8.6 Add inline comments for complex filtering logic

## 9. Documentation

- [ ] 9.1 Document zone-based player filtering in code comments
- [ ] 9.2 Update component JSDoc if present
- [ ] 9.3 Add explanation of season_zone_team_player query logic
- [ ] 9.4 Document date filtering logic in filtering logic

## 10. Final Validation

- [ ] 10.1 Run app without errors after changes
- [ ] 10.2 Test all filter combinations (zone, team, mode, dates, extreme)
- [ ] 10.3 Verify no regressions in existing functionality
- [ ] 10.4 Manual smoke test: Complete battles history workflow
- [ ] 10.5 Verify mobile/responsive design still works
