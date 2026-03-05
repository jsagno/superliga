# Technical Specification: Auto-Link Daily Duels in CRON

## Functional Requirements

### FR1: Daily Duel Detection
- CRON must identify battles with `api_game_mode = 'CW_Duel_1v1'` and `api_battle_type IN ['riverRaceDuel', 'riverRaceDuelColosseum']`
- Detection occurs during battle ingestion from Supercell API
- Only active/valid battles are processed (integrity checks pass)

### FR2: Scheduled Match Creation
- If no `scheduled_match` exists for player/date combination AND `type='CW_DAILY'`, create one
- Fields populated:
  - `player_a_id`: Player from battle_round_player with TEAM side
  - `player_b_id`: NULL (daily duel is single-player format)
  - `type`: 'CW_DAILY'
  - `stage`: 'CW_Duel_1v1'
  - `best_of`: 1
  - `status`: 'PENDING'
  - `scheduled_from`: Start of match day (using game day cutoff logic)
  - `scheduled_to`: End of match day (using game day cutoff logic)
  - `season_id`: From current active season
  - `zone_id`: Determine from player zone assignment
  - Other fields as per CW_DAILY generation logic

### FR3: Battle Linking
- After scheduled_match created/verified, create `scheduled_match_battle_link`
- Fetch first admin user (order by created_at ASC)
- Fields:
  - `scheduled_match_id`: Created/found match
  - `battle_id`: Battle being processed
  - `linked_by_admin`: First admin user UUID (CRON-generated link)

### FR4: Result Calculation
- Calculate battle result using daily duel logic:
  - Count rounds won by player (TEAM side)
  - Evaluate crowns to determine round winners
  - Map to points using schema: 2-0=4, 2-1=3, 1-2=1, 0-2=0
- Create `scheduled_match_result`:
  - `final_score_a`: Player's round wins
  - `final_score_b`: Opponent's round wins
  - `points_a`: Player's points per schema
  - `points_b`: Opponent's points per schema
  - `decided_by`: 'SYSTEM'
- Update `scheduled_match`:
  - `score_a`: final_score_a
  - `score_b`: final_score_b
  - `status`: 'OVERRIDDEN'

## Data Model

### Inputs
```sql
-- From battle/battle_round_player tables already imported by CRON
SELECT 
  b.battle_id,
  b.api_battle_type,
  b.api_game_mode,
  b.battle_time,
  b.round_count,
  brp.player_id,
  brp.side,
  brp.crowns,
  brp.opponent_crowns
FROM battle b
JOIN battle_round br ON br.battle_id = b.battle_id
JOIN battle_round_player brp ON brp.battle_round_id = br.battle_round_id
```

### Outputs
```sql
-- Create/Update scheduled_match
INSERT INTO scheduled_match (
  season_id, zone_id, player_a_id, player_b_id,
  type, stage, best_of, status,
  scheduled_from, scheduled_to, deadline_at
) VALUES (...)

-- Link battle (with admin user UUID)
INSERT INTO scheduled_match_battle_link (
  scheduled_match_id, battle_id, linked_by_admin
) VALUES (...)

-- Save result
INSERT INTO scheduled_match_result (
  scheduled_match_id, final_score_a, final_score_b,
  points_a, points_b, decided_by
) VALUES (...)

-- Update match with scores
UPDATE scheduled_match 
SET score_a=?, score_b=?, status='OVERRIDDEN'
WHERE scheduled_match_id=?
```

**Admin User Lookup:**
```sql
-- Fetch first admin user for linked_by_admin field
SELECT user_id FROM admin_user ORDER BY created_at ASC LIMIT 1;
```

## Algorithm

```
FUNCTION process_battle(battle_record):
  IF battle.api_game_mode != 'CW_Duel_1v1':
    RETURN  # Not a daily duel
  
  IF battle.api_battle_type NOT IN ['riverRaceDuel', 'riverRaceDuelColosseum']:
    RETURN  # Not a valid duel type
  
  # Get system admin user (cache this to avoid repeated queries)
  admin_user_id = get_cached_admin_user_id()
  
  # Extract player from battle
  player_id = battle_round_player[battle.battle_id WHERE side='TEAM'][0].player_id
  active_season_id = get_active_season().season_id
  game_day = convert_battle_time_to_game_day(battle.battle_time)
  zone_id = get_player_zone(player_id, active_season_id)
  
  # Check if scheduled_match exists (with type filter)
  scheduled_match = QUERY scheduled_match WHERE (
    player_a_id = player_id AND
    type = 'CW_DAILY' AND
    DATE(scheduled_from) = game_day AND
    season_id = active_season_id
  )
  
  IF NOT scheduled_match:
    # Create scheduled_match using game day cutoff logic
    game_day_start = convert_to_game_day_start(battle.battle_time)  # Uses cutoff logic
    game_day_end = convert_to_game_day_end(battle.battle_time)      # Uses cutoff logic
    
    scheduled_match_id = INSERT scheduled_match (
      season_id=active_season_id,
      zone_id=zone_id,
      player_a_id=player_id,
      type='CW_DAILY',
      stage='CW_Duel_1v1',
      best_of=1,
      status='PENDING',
      scheduled_from=game_day_start,
      scheduled_to=game_day_end,
      deadline_at=game_day_end
    )
  ELSE:
    scheduled_match_id = scheduled_match.scheduled_match_id
  
  # Check if battle already linked
  existing_link = QUERY scheduled_match_battle_link WHERE (
    scheduled_match_id = scheduled_match_id AND
    battle_id = battle.battle_id
  )
  
  IF existing_link:
    RETURN  # Already linked
  
  # Link battle with admin user
  INSERT scheduled_match_battle_link (
    scheduled_match_id=scheduled_match_id,
    battle_id=battle.battle_id,
    linked_by_admin=admin_user_id
  )
  
  # Calculate result
  result = calculate_daily_duel_result(battle, player_id)
  
  # Save result
  INSERT scheduled_match_result (
    scheduled_match_id=scheduled_match_id,
    final_score_a=result.score_a,
    final_score_b=result.score_b,
    points_a=result.points_a,
    points_b=result.points_b,
    decided_by='SYSTEM'
  )
  
  # Update match
  UPDATE scheduled_match SET (
    score_a=result.score_a,
    score_b=result.score_b,
    status='OVERRIDDEN'
  ) WHERE scheduled_match_id=scheduled_match_id
  
  LOG "Daily duel auto-linked: player={player_id}, battle={battle.battle_id}, match={scheduled_match_id}"
END FUNCTION
```

## Error Handling

- **No player found in battle**: Log warning, skip battle
- **Zone not found**: Use NULL or determine from season default
- **Season not identified**: Skip if no active season
- **Battle already linked**: Check constraint, skip duplicate
- **Database constraint violation**: Log error with context, continue processing
- **Result calculation error**: Log error, set status to ERROR_PENDING for manual review

## Testing Strategy

1. **Unit Tests**:
   - Daily duel detection logic
   - Game day conversion
   - Result calculation

2. **Integration Tests**:
   - End-to-end: Battle → Scheduled Match → Link → Result
   - Edge cases: Same player multiple daily duels, boundary times
   - Constraint tests: Duplicate prevention

3. **Manual Testing**:
   - Process battle in CRON
   - Verify scheduled_match created in database
   - Check daily-points grid reflects new result
   - Verify no manual admin action needed

## Performance Considerations

- Batch processing: Handle multiple daily duels in single query pass
- Indexes: Ensure queries on (player_a_id, type, DATE(scheduled_from)) are optimized
- No N+1 queries: Pre-fetch zones, seasons, player data
- Transaction handling: Use transactions for atomic match+link+result operations

## Rollback/Recovery

- Can manually delete created scheduled_match_battle_link and scheduled_match_result
- Scheduled_match can remain (status=PENDING indicates unresolved)
- Re-process logic should detect existing match and skip duplicate creation
