# Implementation Tasks

## Task List

### Phase 1: Analysis & Design
- [ ] **T1.1** Review current CRON battle sync logic in `packages/cron/cron_clash_sync.py`
- [ ] **T1.2** Study SeasonsList.jsx `calculateBattleResult()` to replicate point calculation logic
- [ ] **T1.3** Document game day conversion logic (battle_cutoff_minutes, timezone handling)
- [ ] **T1.4** Design database transaction strategy for atomic operations (match + link + result)

### Phase 2: Utility Functions
- [ ] **T2.1** Create `get_player_from_battle()` - Extract player_id and metadata from battle
- [ ] **T2.2** Create `get_game_day_boundaries()` - Convert battle_time to game day start/end (both boundaries using cutoff logic)
- [ ] **T2.3** Create `get_cached_admin_user()` - Fetch first admin user UUID and cache it (query once per sync run)
- [ ] **T2.4** Create `find_existing_daily_match()` - Query scheduled_match for player/date/season with type='CW_DAILY'
- [ ] **T2.5** Create `calculate_daily_duel_result()` - Compute score and points from battle rounds
- [ ] **T2.6** Create `map_score_to_points()` - Apply points schema (2-0=4, 2-1=3, 1-2=1, 0-2=0)

### Phase 3: Core Implementation
- [ ] **T3.1** Implement Daily Duel Detection Filter
  - Check `api_game_mode == 'CW_Duel_1v1'`
  - Check `api_battle_type IN ['riverRaceDuel', 'riverRaceDuelColosseum']`
  
- [ ] **T3.2** Implement Scheduled Match Creation Logic
  - Query for existing CW_DAILY match with type filter
  - Create if not exists with all required fields
  - Use game day boundaries (start/end) with cutoff logic
  - Handle zone assignment
  
- [ ] **T3.3** Implement Battle Linking
  - Create scheduled_match_battle_link record
  - Use linked_by_admin field with fetched admin user UUID
  - Handle duplicate prevention via unique constraint
  
- [ ] **T3.4** Implement Result Calculation
  - Extract round data from battle_round_player
  - Calculate winner per round (crowns comparison)
  - Map to final scores
  - Calculate points per schema
  
- [ ] **T3.5** Implement Result Persistence
  - Create scheduled_match_result
  - Update scheduled_match with scores and status='OVERRIDDEN'
  - Use transaction for atomicity

### Phase 4: Error Handling & Edge Cases
- [ ] **T4.1** Handle missing/invalid player data
- [ ] **T4.2** Handle edge case: multiple battles same player/day
- [ ] **T4.3** Handle edge case: timezone boundary conditions (battles near 09:50 UTC)
- [ ] **T4.4** Handle database constraint violations gracefully
- [ ] **T4.5** Implement robust logging for debugging

### Phase 5: Testing
- [ ] **T5.1** Unit test: Daily duel detection logic (with mocks)
- [ ] **T5.2** Unit test: Game day conversion (boundary cases)
- [ ] **T5.3** Unit test: Point calculation (all score combinations)
- [ ] **T5.4** Integration test: End-to-end daily duel process
- [ ] **T5.5** Integration test: Prevent duplicate processing (idempotency)
- [ ] **T5.6** Manual test: Process sample battle, verify admin panel reflects result

### Phase 6: Documentation & Validation
- [ ] **T6.1** Add code comments explaining daily duel auto-linking logic
- [ ] **T6.2** Document any configuration changes needed
- [ ] **T6.3** Create migration guide (if applicable)
- [ ] **T6.4** Update CRON README with new feature

### Phase 7: Integration & Deployment
- [ ] **T7.1** Test with full CRON sync cycle
- [ ] **T7.2** Verify no regressions in existing CRON functionality
- [ ] **T7.3** Test daily-points grid shows correct values from auto-linked results
- [ ] **T7.4** Prepare deployment steps
- [ ] **T7.5** Monitor production for errors/edge cases

## Success Criteria

✅ **Feature Complete When:**
1. CRON detects daily duel battles automatically
2. Scheduled_match created with correct fields
3. Battle linked within sync process
4. Result calculated and persisted correctly
5. Daily-points grid reflects new data without manual action
6. No duplicates created on re-processing
7. All tests pass (unit + integration)
8. Zero regressions in existing functionality

## Time Estimates

- Phase 1: 2 hours
- Phase 2: 3 hours
- Phase 3: 4 hours
- Phase 4: 2 hours
- Phase 5: 3 hours
- Phase 6: 1 hour
- Phase 7: 2 hours

**Total: ~17 hours of development**

## Dependencies

- Must understand how CRON currently syncs battles
- Must understand SeasonsList.jsx auto-vincular logic
- Must understand game day cutoff logic (09:50 UTC boundary)
- Supabase client & transaction handling knowledge
