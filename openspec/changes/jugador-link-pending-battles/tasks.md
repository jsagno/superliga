## 1. OpenSpec Artifacts
- [x] 1.1 Write proposal with scope and business value
- [x] 1.2 Write design describing reuse of existing link panel
- [x] 1.3 Add delta spec for pending-card linking requirements

## 2. Dashboard Integration
- [x] 2.1 Add state to track selected pending match for linking
- [x] 2.2 Wire `PendingBattleCard` `onLink` to open `VincularBatallaPanel`
- [x] 2.3 Pass `appUserId` and callbacks to panel
- [x] 2.4 Refresh dashboard pending data after successful link

## 3. Batallas Pendientes Integration
- [x] 3.1 Add state to track selected pending match for linking
- [x] 3.2 Wire card `onLink` to open `VincularBatallaPanel`
- [x] 3.3 Pass `appUserId` and callbacks to panel
- [x] 3.4 Refresh pending list and counter after successful link

## 4. Validation
- [x] 4.1 Run build for liga-jugador
- [x] 4.2 Verify no regressions in pending-card disabled behavior

## 5. Candidate Filtering Constraints
- [x] 5.1 Validate schema fields for mode filtering (`season_competition_config.api_game_mode`)
- [x] 5.2 Restrict unlinked candidates to configured mode for selected pending match
- [x] 5.3 Restrict unlinked candidates to battles that include both scheduled players

## 6. Admin Cup-Matches Visibility
- [x] 6.1 Include `LINKED` in cup-matches status filter options
- [x] 6.2 Verify linked scheduled matches are visible when `LINKED` filter is selected