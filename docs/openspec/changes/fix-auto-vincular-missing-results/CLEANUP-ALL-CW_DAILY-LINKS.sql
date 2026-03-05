-- ============================================================================
-- CLEANUP SCRIPT: Remove ALL linked battles from CW_DAILY matches
-- ============================================================================
-- Purpose: Delete all battle links and results for ALL CW_DAILY matches,
--          then reset them to PENDING status for fresh auto-linking.
--
-- This is a complete reset of all CW_DAILY data across all players.
-- ============================================================================

BEGIN;

-- Find all CW_DAILY matches
CREATE TEMP TABLE IF NOT EXISTS cw_daily_matches AS (
  SELECT scheduled_match_id
  FROM scheduled_match
  WHERE type = 'CW_DAILY'
);

-- Preview counts
SELECT
  COUNT(*) AS total_cw_daily_matches,
  COUNT(DISTINCT smbl.battle_id) AS linked_battles,
  COUNT(DISTINCT smr.scheduled_match_id) AS matches_with_results
FROM cw_daily_matches cdm
LEFT JOIN scheduled_match_battle_link smbl ON smbl.scheduled_match_id = cdm.scheduled_match_id
LEFT JOIN scheduled_match_result smr ON smr.scheduled_match_id = cdm.scheduled_match_id;

-- Delete all battle links for CW_DAILY matches
DELETE FROM scheduled_match_battle_link smbl
WHERE EXISTS (
  SELECT 1
  FROM cw_daily_matches cdm
  WHERE cdm.scheduled_match_id = smbl.scheduled_match_id
);

-- Delete all results for CW_DAILY matches
DELETE FROM scheduled_match_result smr
WHERE EXISTS (
  SELECT 1
  FROM cw_daily_matches cdm
  WHERE cdm.scheduled_match_id = smr.scheduled_match_id
);

-- Reset all CW_DAILY matches to PENDING
UPDATE scheduled_match sm
SET
  score_a = NULL,
  score_b = NULL,
  status = 'PENDING',
  updated_at = NOW()
WHERE sm.type = 'CW_DAILY'
  AND sm.status <> 'CANCELED';

-- Audit: Show counts deleted
SELECT
  'Links deleted' AS action,
  COUNT(*) AS count
FROM cw_daily_matches cdm
LEFT JOIN scheduled_match_battle_link smbl ON smbl.scheduled_match_id = cdm.scheduled_match_id
WHERE smbl.scheduled_match_id IS NULL
GROUP BY action

UNION ALL

SELECT
  'CW_DAILY matches reset' AS action,
  COUNT(*) AS count
FROM scheduled_match
WHERE type = 'CW_DAILY'
  AND status = 'PENDING';

-- Post-check: Verify all CW_DAILY are now clean
SELECT
  DATE(sm.scheduled_from) AS match_date,
  COUNT(*) AS total_matches,
  COUNT(smbl.scheduled_match_id) AS matches_with_links,
  COUNT(smr.scheduled_match_id) AS matches_with_results
FROM scheduled_match sm
LEFT JOIN scheduled_match_battle_link smbl ON smbl.scheduled_match_id = sm.scheduled_match_id
LEFT JOIN scheduled_match_result smr ON smr.scheduled_match_id = sm.scheduled_match_id
WHERE sm.type = 'CW_DAILY'
GROUP BY DATE(sm.scheduled_from)
ORDER BY match_date DESC
LIMIT 20;

-- COMMIT;
ROLLBACK;
