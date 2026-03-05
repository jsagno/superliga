-- ============================================================================
-- CLEANUP SCRIPT: Remove only mismatched linked battle(s) for player Guts
-- ============================================================================
-- Player: ff82c140-7a65-4ad6-a479-3ed992d97e31
-- Purpose: Remove only CW_DAILY links/results where linked battle type/mode
--          does NOT match season_competition_config for that match.
--
-- This keeps correct rows intact and resets only bad rows to PENDING.
--
-- Schema validated against:
-- - scheduled_match(season_id, competition_id, stage, type, player_a_id, status, score_a, score_b)
-- - season_competition_config(season_id, competition_id, stage, api_battle_type, api_game_mode)
-- - scheduled_match_battle_link(scheduled_match_id, battle_id)
-- - scheduled_match_result(scheduled_match_id)
-- - battle(battle_id, api_battle_type, api_game_mode)
-- ============================================================================

BEGIN;

CREATE TEMP TABLE IF NOT EXISTS guts_mismatch_matches AS (
  SELECT DISTINCT
    sm.scheduled_match_id,
    DATE(sm.scheduled_from) AS match_date,
    scc.api_battle_type AS expected_battle_type,
    scc.api_game_mode AS expected_game_mode,
    b.battle_id,
    b.api_battle_type AS linked_battle_type,
    b.api_game_mode AS linked_game_mode
  FROM scheduled_match sm
  JOIN season_competition_config scc
    ON scc.season_id = sm.season_id
   AND scc.competition_id = sm.competition_id
   AND scc.stage = sm.stage
  JOIN scheduled_match_battle_link smbl
    ON smbl.scheduled_match_id = sm.scheduled_match_id
  JOIN battle b
    ON b.battle_id = smbl.battle_id
  WHERE sm.type = 'CW_DAILY'
    AND sm.player_a_id = 'ff82c140-7a65-4ad6-a479-3ed992d97e31'
    AND (
      b.api_battle_type IS DISTINCT FROM scc.api_battle_type
      OR b.api_game_mode IS DISTINCT FROM scc.api_game_mode
    )
);

-- Preview mismatches to be removed
SELECT
  scheduled_match_id,
  match_date,
  expected_battle_type,
  expected_game_mode,
  linked_battle_type,
  linked_game_mode,
  battle_id
FROM guts_mismatch_matches
ORDER BY match_date DESC;

-- Delete links only for mismatched rows
DELETE FROM scheduled_match_battle_link smbl
WHERE EXISTS (
  SELECT 1
  FROM guts_mismatch_matches gmm
  WHERE gmm.scheduled_match_id = smbl.scheduled_match_id
    AND gmm.battle_id = smbl.battle_id
);

-- Delete results only for mismatched matches (so they can be recalculated)
DELETE FROM scheduled_match_result smr
WHERE EXISTS (
  SELECT 1
  FROM guts_mismatch_matches gmm
  WHERE gmm.scheduled_match_id = smr.scheduled_match_id
);

-- Reset affected matches to PENDING (except canceled)
UPDATE scheduled_match sm
SET
  status = 'PENDING',
  score_a = NULL,
  score_b = NULL,
  updated_at = NOW()
WHERE sm.scheduled_match_id IN (SELECT scheduled_match_id FROM guts_mismatch_matches)
  AND sm.status <> 'CANCELED';

-- Post-check for Guts links
SELECT
  sm.scheduled_match_id,
  DATE(sm.scheduled_from) AS match_date,
  sm.status,
  b.api_battle_type,
  b.api_game_mode,
  scc.api_battle_type AS expected_battle_type,
  scc.api_game_mode AS expected_game_mode
FROM scheduled_match sm
LEFT JOIN scheduled_match_battle_link smbl ON smbl.scheduled_match_id = sm.scheduled_match_id
LEFT JOIN battle b ON b.battle_id = smbl.battle_id
LEFT JOIN season_competition_config scc
  ON scc.season_id = sm.season_id
 AND scc.competition_id = sm.competition_id
 AND scc.stage = sm.stage
WHERE sm.type = 'CW_DAILY'
  AND sm.player_a_id = 'ff82c140-7a65-4ad6-a479-3ed992d97e31'
ORDER BY match_date DESC;

-- COMMIT;
ROLLBACK;
