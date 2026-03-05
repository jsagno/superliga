-- ============================================================================
-- CLEANUP SCRIPT: Reset only player Guts (CW_DAILY)
-- ============================================================================
-- Player: ff82c140-7a65-4ad6-a479-3ed992d97e31
-- Purpose: Remove links/results for this player only, then re-run auto-link
--          quickly to validate CW_Duel_1v1 filtering.
--
-- Schema-validated tables/columns used:
-- - scheduled_match(type, player_a_id, scheduled_match_id, status, score_a, score_b)
-- - scheduled_match_battle_link(scheduled_match_id, battle_id)
-- - scheduled_match_result(scheduled_match_id, decided_by)
--
-- Safety: Transaction + ROLLBACK default
-- ============================================================================

BEGIN;

CREATE TEMP TABLE IF NOT EXISTS guts_target_matches AS (
  SELECT
    sm.scheduled_match_id,
    DATE(sm.scheduled_from) AS match_date
  FROM scheduled_match sm
  WHERE sm.type = 'CW_DAILY'
    AND sm.player_a_id = 'ff82c140-7a65-4ad6-a479-3ed992d97e31'
);

CREATE TEMP TABLE IF NOT EXISTS guts_cleanup_audit AS (
  SELECT
    gtm.match_date,
    gtm.scheduled_match_id,
    smbl.battle_id,
    smr.decided_by
  FROM guts_target_matches gtm
  LEFT JOIN scheduled_match_battle_link smbl
    ON smbl.scheduled_match_id = gtm.scheduled_match_id
  LEFT JOIN scheduled_match_result smr
    ON smr.scheduled_match_id = gtm.scheduled_match_id
);

-- Delete links for Guts CW_DAILY matches
DELETE FROM scheduled_match_battle_link smbl
WHERE EXISTS (
  SELECT 1
  FROM guts_target_matches gtm
  WHERE gtm.scheduled_match_id = smbl.scheduled_match_id
);

-- Delete results for Guts CW_DAILY matches
DELETE FROM scheduled_match_result smr
WHERE EXISTS (
  SELECT 1
  FROM guts_target_matches gtm
  WHERE gtm.scheduled_match_id = smr.scheduled_match_id
);

-- Reset matches to pending (except canceled)
UPDATE scheduled_match sm
SET
  status = 'PENDING',
  score_a = NULL,
  score_b = NULL,
  updated_at = NOW()
WHERE sm.scheduled_match_id IN (SELECT scheduled_match_id FROM guts_target_matches)
  AND sm.status <> 'CANCELED';

-- Audit output
SELECT
  match_date,
  COUNT(DISTINCT scheduled_match_id) AS matches_targeted,
  COUNT(DISTINCT battle_id) AS links_found_before_delete,
  COUNT(*) FILTER (WHERE decided_by IS NOT NULL) AS results_found_before_delete
FROM guts_cleanup_audit
GROUP BY match_date
ORDER BY match_date DESC;

-- Verify clean state for Guts only
SELECT
  DATE(sm.scheduled_from) AS match_date,
  sm.scheduled_match_id,
  sm.status,
  sm.score_a,
  sm.score_b,
  smr.scheduled_match_id AS has_result,
  smbl.scheduled_match_id AS has_link
FROM scheduled_match sm
LEFT JOIN scheduled_match_result smr ON smr.scheduled_match_id = sm.scheduled_match_id
LEFT JOIN scheduled_match_battle_link smbl ON smbl.scheduled_match_id = sm.scheduled_match_id
WHERE sm.type = 'CW_DAILY'
  AND sm.player_a_id = 'ff82c140-7a65-4ad6-a479-3ed992d97e31'
ORDER BY match_date DESC;

-- COMMIT;
ROLLBACK;
