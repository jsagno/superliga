-- ============================================================================
-- CLEANUP SCRIPT: Direct removal of wrong battle type for player Guts
-- ============================================================================
-- Player: ff82c140-7a65-4ad6-a479-3ed992d97e31
-- Purpose: Remove CW_DAILY links where api_battle_type is riverRacePvP
--          (should be riverRaceDuel or riverRaceDuelColosseum).
--
-- This is a direct approach that doesn't rely on season_competition_config.
-- ============================================================================

BEGIN;

-- Find bad links (riverRacePvP or CW_Battle_1v1 for CW_DAILY)
CREATE TEMP TABLE IF NOT EXISTS guts_bad_links AS (
  SELECT DISTINCT
    sm.scheduled_match_id,
    DATE(sm.scheduled_from) AS match_date,
    smbl.battle_id,
    b.api_battle_type,
    b.api_game_mode,
    sm.status
  FROM scheduled_match sm
  JOIN scheduled_match_battle_link smbl
    ON smbl.scheduled_match_id = sm.scheduled_match_id
  JOIN battle b
    ON b.battle_id = smbl.battle_id
  WHERE sm.type = 'CW_DAILY'
    AND sm.player_a_id = 'ff82c140-7a65-4ad6-a479-3ed992d97e31'
    AND (
      b.api_battle_type = 'riverRacePvP'
      OR b.api_game_mode = 'CW_Battle_1v1'
    )
);

-- Preview what will be removed
SELECT
  match_date,
  api_battle_type,
  api_game_mode,
  status,
  battle_id
FROM guts_bad_links
ORDER BY match_date DESC;

-- Delete bad links
DELETE FROM scheduled_match_battle_link smbl
WHERE EXISTS (
  SELECT 1
  FROM guts_bad_links gbl
  WHERE gbl.scheduled_match_id = smbl.scheduled_match_id
    AND gbl.battle_id = smbl.battle_id
);

-- Delete results for affected matches
DELETE FROM scheduled_match_result smr
WHERE EXISTS (
  SELECT 1
  FROM guts_bad_links gbl
  WHERE gbl.scheduled_match_id = smr.scheduled_match_id
);

-- Reset affected matches to PENDING
UPDATE scheduled_match sm
SET
  status = 'PENDING',
  score_a = NULL,
  score_b = NULL,
  updated_at = NOW()
WHERE sm.scheduled_match_id IN (SELECT scheduled_match_id FROM guts_bad_links)
  AND sm.status <> 'CANCELED';

-- Audit summary
SELECT
  COUNT(*) AS links_removed,
  STRING_AGG(DISTINCT match_date::text, ', ' ORDER BY match_date::text) AS affected_dates
FROM guts_bad_links;

-- Post-check: Verify 2026-03-01 is now PENDING with no link
SELECT
  sm.scheduled_match_id,
  DATE(sm.scheduled_from) AS match_date,
  sm.status,
  b.api_battle_type,
  b.api_game_mode
FROM scheduled_match sm
LEFT JOIN scheduled_match_battle_link smbl ON smbl.scheduled_match_id = sm.scheduled_match_id
LEFT JOIN battle b ON b.battle_id = smbl.battle_id
WHERE sm.type = 'CW_DAILY'
  AND sm.player_a_id = 'ff82c140-7a65-4ad6-a479-3ed992d97e31'
  AND DATE(sm.scheduled_from) = '2026-03-01';

-- COMMIT;
ROLLBACK;
