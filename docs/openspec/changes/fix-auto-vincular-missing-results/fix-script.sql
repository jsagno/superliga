-- ============================================================================
-- REPAIR SCRIPT: Auto-Vincular Missing Results
-- ============================================================================
-- Purpose: Backfill missing scheduled_match_result records for matches that
--          were skipped by auto-vincular due to stage/api_game_mode mismatch
--          and query truncation issues.
--
-- Affected Period: 2026-02-19 through 2026-03-01
-- Estimated Impact: ~32 matches without results
--
-- Root Cause: SeasonsList.jsx auto-vincular used scheduled_match.stage 
--             directly as battle.api_game_mode filter, but stage is tournament
--             stage and must be mapped via season_competition_config.
--
-- Safety: This script is IDEMPOTENT - it checks for existing records before
--         inserting and can be run multiple times safely.
--
-- Constraint: Database has unique constraint "uq_battle_used_once" on battle_id
--             which means each battle can only be linked to ONE scheduled match.
--             Script filters out battles already linked to other matches.
--
-- ============================================================================

BEGIN;

-- Create temporary table to track repair operations for audit
CREATE TEMP TABLE IF NOT EXISTS repair_audit (
    scheduled_match_id UUID,
    player_nick TEXT,
    match_date DATE,
    battle_id UUID,
    repair_action TEXT,
    points_calculated INTEGER,
    repair_timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- STEP 1: Identify and repair missing battle links + results
-- ============================================================================

-- For each CW_DAILY PENDING match without a result:
-- 1. Find the correct api_game_mode from season_competition_config
-- 2. Find available battles for player in time window
-- 3. Apply battle_cutoff_minutes logic to match game dates
-- 4. Select best battle (earliest in window)
-- 5. Calculate points from battle data
-- 6. Insert link + result if not already exists

-- Materialize CTEs as temporary tables so they persist across statements
DROP TABLE IF EXISTS temp_missing_matches;
CREATE TEMP TABLE temp_missing_matches AS (
    -- Find all PENDING CW_DAILY matches without results in affected date range
    SELECT 
        sm.scheduled_match_id,
        sm.season_id,
        sm.player_a_id,
        sm.scheduled_from,
        sm.scheduled_to,
        sm.stage,
        sm.best_of,
        DATE(sm.scheduled_from) as match_date,
        p.nick as player_nick,
        s.battle_cutoff_minutes
    FROM scheduled_match sm
    JOIN player p ON p.player_id = sm.player_a_id
    JOIN season s ON s.season_id = sm.season_id
    LEFT JOIN scheduled_match_result smr ON smr.scheduled_match_id = sm.scheduled_match_id
    WHERE sm.type = 'CW_DAILY'
      AND sm.status = 'PENDING'
      AND smr.scheduled_match_id IS NULL  -- No result exists
      AND sm.scheduled_from >= '2026-02-19'
      AND sm.scheduled_from < '2026-03-02'
);

DROP TABLE IF EXISTS temp_competition_modes;
CREATE TEMP TABLE temp_competition_modes AS (
    -- Map stage to api_game_mode via season_competition_config
    SELECT DISTINCT
        mm.scheduled_match_id,
        mm.season_id,
        mm.stage,
        scc.api_game_mode,
        scc.competition_id
    FROM temp_missing_matches mm
    LEFT JOIN season_competition_config scc 
        ON scc.season_id = mm.season_id 
        AND scc.stage = mm.stage
);

DROP TABLE IF EXISTS temp_player_battles;
CREATE TEMP TABLE temp_player_battles AS (
    -- Find all battles for affected players in their time windows
    -- IMPORTANT: Excludes battles already linked to OTHER scheduled matches
    -- due to unique constraint "uq_battle_used_once" on battle_id
    SELECT DISTINCT
        mm.scheduled_match_id,
        mm.player_a_id,
        mm.scheduled_from,
        mm.scheduled_to,
        mm.battle_cutoff_minutes,
        b.battle_id,
        b.battle_time,
        b.round_count,
        cm.api_game_mode as expected_mode,
        b.api_game_mode as battle_mode,
        -- Apply battle cutoff to get game date key
        DATE(b.battle_time - (mm.battle_cutoff_minutes || ' minutes')::INTERVAL) as battle_game_date,
        DATE(mm.scheduled_from) as scheduled_game_date,
        -- Rank battles by time (earliest first)
        ROW_NUMBER() OVER (
            PARTITION BY mm.scheduled_match_id 
            ORDER BY b.battle_time ASC
        ) as battle_rank
    FROM temp_missing_matches mm
    JOIN temp_competition_modes cm ON cm.scheduled_match_id = mm.scheduled_match_id
    JOIN battle_round_player brp ON brp.player_id = mm.player_a_id
    JOIN battle_round br ON br.battle_round_id = brp.battle_round_id
    JOIN battle b ON b.battle_id = br.battle_id
    WHERE b.battle_time >= mm.scheduled_from - INTERVAL '30 minutes'  -- Buffer
      AND b.battle_time <= mm.scheduled_to + INTERVAL '30 minutes'    -- Buffer
      AND (
          cm.api_game_mode IS NULL  -- No mode configured, accept any
          OR b.api_game_mode = cm.api_game_mode  -- Mode matches
      )
      -- Ensure battle's game date matches scheduled match date
      AND DATE(b.battle_time - (mm.battle_cutoff_minutes || ' minutes')::INTERVAL) 
          = DATE(mm.scheduled_from)
      -- Exclude battles already linked to OTHER scheduled matches (constraint: uq_battle_used_once)
      AND NOT EXISTS (
          SELECT 1 
          FROM scheduled_match_battle_link smbl_existing
          WHERE smbl_existing.battle_id = b.battle_id
            AND smbl_existing.scheduled_match_id != mm.scheduled_match_id
      )
);

DROP TABLE IF EXISTS temp_best_battles;
CREATE TEMP TABLE temp_best_battles AS (
    -- Select the best (earliest) battle for each match
    SELECT *
    FROM temp_player_battles
    WHERE battle_rank = 1
);

DROP TABLE IF EXISTS temp_battle_results;
CREATE TEMP TABLE temp_battle_results AS (
    -- Calculate results for each battle
    SELECT 
        bb.scheduled_match_id,
        bb.battle_id,
        bb.player_a_id,
        bb.round_count,
        
        -- Calculate team vs opponent crowns per round
        -- Note: Using battle_round.round_no to group rounds
        (
            SELECT COUNT(DISTINCT br2.round_no)
            FROM battle_round br2
            JOIN battle_round_player brp2 ON brp2.battle_round_id = br2.battle_round_id
            WHERE br2.battle_id = bb.battle_id
              AND brp2.side = 'TEAM'
            GROUP BY br2.battle_id
            HAVING SUM(
                CASE 
                    WHEN brp2.side = 'TEAM' 
                    THEN brp2.crowns 
                    ELSE 0 
                END
            ) > SUM(
                CASE 
                    WHEN brp2.side = 'TEAM' 
                    THEN brp2.opponent_crowns 
                    ELSE brp2.crowns 
                END
            )
        ) as team_rounds_won,
        
        (
            SELECT COUNT(DISTINCT br2.round_no)
            FROM battle_round br2
            JOIN battle_round_player brp2 ON brp2.battle_round_id = br2.battle_round_id
            WHERE br2.battle_id = bb.battle_id
              AND brp2.side = 'OPPONENT'
            GROUP BY br2.battle_id
            HAVING SUM(
                CASE 
                    WHEN brp2.side = 'OPPONENT' 
                    THEN brp2.crowns 
                    ELSE 0 
                END
            ) > SUM(
                CASE 
                    WHEN brp2.side = 'OPPONENT' 
                    THEN brp2.opponent_crowns 
                    ELSE brp2.crowns 
                END
            )
        ) as opp_rounds_won,
        
        -- Determine player's side
        (
            SELECT brp3.side
            FROM battle_round br3
            JOIN battle_round_player brp3 ON brp3.battle_round_id = br3.battle_round_id
            WHERE br3.battle_id = bb.battle_id
              AND brp3.player_id = bb.player_a_id
            LIMIT 1
        ) as player_side,
        
        -- Check if player was extreme/risky on this date
        EXISTS(
            SELECT 1
            FROM season_extreme_participant sep
            WHERE sep.player_id = bb.player_a_id
              AND DATE(bb.battle_time - (mm.battle_cutoff_minutes || ' minutes')::INTERVAL)
                  BETWEEN COALESCE(sep.start_date, '1900-01-01') 
                      AND COALESCE(sep.end_date, '2100-12-31')
        ) as is_extreme_risky
        
    FROM temp_best_battles bb
    JOIN temp_missing_matches mm ON mm.scheduled_match_id = bb.scheduled_match_id
);

DROP TABLE IF EXISTS temp_calculated_results;
CREATE TEMP TABLE temp_calculated_results AS (
    -- Apply point calculation rules
    SELECT 
        br.scheduled_match_id,
        br.battle_id,
        br.player_a_id,
        
        -- Determine final scores based on player side
        CASE 
            WHEN br.player_side = 'TEAM' THEN COALESCE(br.team_rounds_won, 0)
            ELSE COALESCE(br.opp_rounds_won, 0)
        END as final_score_a,
        
        CASE 
            WHEN br.player_side = 'TEAM' THEN COALESCE(br.opp_rounds_won, 0)
            ELSE COALESCE(br.team_rounds_won, 0)
        END as final_score_b,
        
        br.round_count,
        br.is_extreme_risky,
        
        -- Calculate points (assuming BO3 = 3 rounds, need 2 to win)
        CASE
            -- Perfect win (2-0 in BO3)
            WHEN (br.player_side = 'TEAM' AND br.team_rounds_won >= CEIL(br.round_count / 2.0) 
                  AND COALESCE(br.opp_rounds_won, 0) = 0)
              OR (br.player_side != 'TEAM' AND br.opp_rounds_won >= CEIL(br.round_count / 2.0) 
                  AND COALESCE(br.team_rounds_won, 0) = 0)
            THEN CASE WHEN br.is_extreme_risky THEN 5 ELSE 4 END
            
            -- Win with loss (2-1 in BO3)
            WHEN (br.player_side = 'TEAM' AND br.team_rounds_won >= CEIL(br.round_count / 2.0))
              OR (br.player_side != 'TEAM' AND br.opp_rounds_won >= CEIL(br.round_count / 2.0))
            THEN CASE WHEN br.is_extreme_risky THEN 4 ELSE 3 END
            
            -- Loss with win (1-2 in BO3)
            WHEN (br.player_side = 'TEAM' AND br.team_rounds_won > 0)
              OR (br.player_side != 'TEAM' AND br.opp_rounds_won > 0)
            THEN 1
            
            -- Complete loss (0-2 in BO3)
            ELSE 0
        END as points_a
        
    FROM temp_battle_results br
);

-- ============================================================================
-- STEP 2: Insert battle links (only if not already exists)
-- ============================================================================

INSERT INTO scheduled_match_battle_link (
    scheduled_match_id,
    battle_id
)
SELECT 
    cr.scheduled_match_id,
    cr.battle_id
FROM temp_calculated_results cr
WHERE NOT EXISTS (
    SELECT 1 
    FROM scheduled_match_battle_link smbl 
    WHERE smbl.scheduled_match_id = cr.scheduled_match_id
      AND smbl.battle_id = cr.battle_id
)
ON CONFLICT (scheduled_match_id, battle_id) DO NOTHING;

-- ============================================================================
-- STEP 3: Insert match results (only if not already exists)
-- ============================================================================

INSERT INTO scheduled_match_result (
    scheduled_match_id,
    final_score_a,
    final_score_b,
    points_a,
    points_b,
    decided_by
)
SELECT 
    cr.scheduled_match_id,
    cr.final_score_a,
    cr.final_score_b,
    cr.points_a,
    0 as points_b,  -- Player B doesn't exist in CW_DAILY
    'ADMIN' as decided_by
FROM temp_calculated_results cr
WHERE NOT EXISTS (
    SELECT 1 
    FROM scheduled_match_result smr 
    WHERE smr.scheduled_match_id = cr.scheduled_match_id
)
ON CONFLICT (scheduled_match_id) DO NOTHING;

-- ============================================================================
-- STEP 4: Update match status (only if result now exists)
-- ============================================================================

UPDATE scheduled_match sm
SET 
    score_a = smr.final_score_a,
    score_b = smr.final_score_b,
    status = 'OVERRIDDEN',
    updated_at = NOW()
FROM scheduled_match_result smr
WHERE sm.scheduled_match_id = smr.scheduled_match_id
  AND sm.status = 'PENDING'
  AND sm.type = 'CW_DAILY'
  AND sm.scheduled_from >= '2026-02-19'
  AND sm.scheduled_from < '2026-03-02';

-- ============================================================================
-- STEP 5: Log repairs for audit
-- ============================================================================

INSERT INTO repair_audit (
    scheduled_match_id,
    player_nick,
    match_date,
    battle_id,
    repair_action,
    points_calculated
)
SELECT 
    mm.scheduled_match_id,
    mm.player_nick,
    mm.match_date,
    cr.battle_id,
    'LINK_AND_RESULT_CREATED',
    cr.points_a
FROM temp_missing_matches mm
JOIN temp_calculated_results cr ON cr.scheduled_match_id = mm.scheduled_match_id
WHERE EXISTS (
    SELECT 1 
    FROM scheduled_match_result smr 
    WHERE smr.scheduled_match_id = mm.scheduled_match_id
);

-- ============================================================================
-- STEP 6: Report summary
-- ============================================================================

DO $$
DECLARE
    repaired_count INTEGER;
    audit_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO repaired_count
    FROM scheduled_match sm
    JOIN scheduled_match_result smr ON smr.scheduled_match_id = sm.scheduled_match_id
    WHERE sm.type = 'CW_DAILY'
      AND sm.scheduled_from >= '2026-02-19'
      AND sm.scheduled_from < '2026-03-02'
      AND NOT EXISTS (
          SELECT 1 FROM repair_audit ra WHERE ra.scheduled_match_id = sm.scheduled_match_id
      );
    
    SELECT COUNT(*) INTO audit_count FROM repair_audit;
    
    RAISE NOTICE '=================================================================';
    RAISE NOTICE 'REPAIR SCRIPT COMPLETED';
    RAISE NOTICE '=================================================================';
    RAISE NOTICE 'Matches repaired this run: %', audit_count;
    RAISE NOTICE 'Total matches with results: %', repaired_count + audit_count;
    RAISE NOTICE '';
    RAISE NOTICE 'View repair details: SELECT * FROM repair_audit ORDER BY match_date;';
    RAISE NOTICE '=================================================================';
END $$;

-- Display repair audit details
SELECT 
    match_date,
    player_nick,
    battle_id,
    points_calculated,
    repair_action,
    repair_timestamp
FROM repair_audit
ORDER BY match_date, player_nick;

-- Verify coverage after repair
SELECT 
    DATE(sm.scheduled_from) as match_date,
    COUNT(*) as total_matches,
    COUNT(smr.scheduled_match_id) as matches_with_results,
    COUNT(*) - COUNT(smr.scheduled_match_id) as still_missing,
    ROUND(100.0 * COUNT(smr.scheduled_match_id) / COUNT(*), 2) as percent_coverage
FROM scheduled_match sm
LEFT JOIN scheduled_match_result smr ON smr.scheduled_match_id = sm.scheduled_match_id
WHERE sm.type = 'CW_DAILY'
  AND sm.scheduled_from >= '2026-02-19'
  AND sm.scheduled_from < '2026-03-02'
GROUP BY DATE(sm.scheduled_from)
ORDER BY match_date;

-- ============================================================================
-- COMMIT or ROLLBACK
-- ============================================================================
-- Review the audit output above before committing.
-- To commit: COMMIT;
-- To rollback: ROLLBACK;

-- For now, showing what would be done without committing:
-- COMMIT;

ROLLBACK;  -- Remove this line and uncomment COMMIT above when ready to apply
