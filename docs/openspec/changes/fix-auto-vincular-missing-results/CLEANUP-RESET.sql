-- ============================================================================
-- CLEANUP SCRIPT: Reset Auto-Vincular Data for Daily Duels (CW_DAILY)
-- ============================================================================
-- Purpose: Remove ALL battle links and results created by auto-vincular for
--          daily duels (CW_DAILY). This resets the system to a clean state
--          before attempting the fix again.
--
-- Scope: ALL CW_DAILY battle links and ALL CW_DAILY results (any decided_by)
--        Does NOT affect other match types
--
-- Safety: This script is IDEMPOTENT - it checks for existence before deleting
--         Can be run multiple times safely
--
-- ============================================================================

BEGIN;

-- Create audit table to track what we're deleting
CREATE TEMP TABLE IF NOT EXISTS cleanup_audit (
    action TEXT,
    scheduled_match_id UUID,
    battle_id UUID,
    player_nick TEXT,
    match_date DATE,
    decided_by TEXT,
    cleanup_timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- STEP 1: Identify ALL CW_DAILY matches (full reset scope)
-- ============================================================================

CREATE TEMP TABLE cw_daily_target_matches AS (
    SELECT
        sm.scheduled_match_id,
        sm.type,
        sm.status,
        DATE(sm.scheduled_from) as match_date,
        p.nick as player_nick
    FROM scheduled_match sm
    LEFT JOIN player p ON p.player_id = sm.player_a_id
    WHERE sm.type = 'CW_DAILY'
);

-- ============================================================================
-- STEP 2: Get battle links to delete
-- ============================================================================

CREATE TEMP TABLE battles_to_unlink AS (
    SELECT
        smbl.scheduled_match_battle_link_id,
        smbl.scheduled_match_id,
        smbl.battle_id,
        cw.player_nick,
        cw.match_date
    FROM scheduled_match_battle_link smbl
    JOIN cw_daily_target_matches cw ON cw.scheduled_match_id = smbl.scheduled_match_id
);

CREATE TEMP TABLE results_to_delete AS (
    SELECT
        smr.scheduled_match_id,
        cw.player_nick,
        cw.match_date,
        smr.decided_by
    FROM scheduled_match_result smr
    JOIN cw_daily_target_matches cw ON cw.scheduled_match_id = smr.scheduled_match_id
);

-- ============================================================================
-- STEP 3: Log deletions for audit trail
-- ============================================================================

INSERT INTO cleanup_audit (action, scheduled_match_id, battle_id, player_nick, match_date, decided_by)
SELECT 'DELETE_BATTLE_LINK', scheduled_match_id, battle_id, player_nick, match_date, NULL
FROM battles_to_unlink;

INSERT INTO cleanup_audit (action, scheduled_match_id, battle_id, player_nick, match_date, decided_by)
SELECT 'DELETE_RESULT', scheduled_match_id, NULL, player_nick, match_date, decided_by
FROM results_to_delete;

-- ============================================================================
-- STEP 4: Delete battle links (associated with CW_DAILY auto-vincular results)
-- ============================================================================

DELETE FROM scheduled_match_battle_link smbl
WHERE EXISTS (
    SELECT 1
    FROM cw_daily_target_matches cw
    WHERE cw.scheduled_match_id = smbl.scheduled_match_id
);

-- ============================================================================
-- STEP 5: Delete results for CW_DAILY auto-vincular matches
-- ============================================================================

DELETE FROM scheduled_match_result smr
WHERE EXISTS (
    SELECT 1
    FROM cw_daily_target_matches cw
    WHERE cw.scheduled_match_id = smr.scheduled_match_id
);

-- ============================================================================
-- STEP 6: Reset scheduled_match status back to PENDING
-- ============================================================================

UPDATE scheduled_match sm
SET 
    status = 'PENDING',
    score_a = NULL,
    score_b = NULL,
    updated_at = NOW()
WHERE sm.type = 'CW_DAILY'
    AND sm.status <> 'CANCELED';

-- ============================================================================
-- STEP 7: Report cleanup summary
-- ============================================================================

DO $$
DECLARE
    links_deleted INTEGER;
    results_deleted INTEGER;
    matches_reset INTEGER;
BEGIN
    -- Count rows affected (from cleanup_audit which was populated during deletes)
    SELECT COUNT(*) INTO links_deleted FROM cleanup_audit WHERE action = 'DELETE_BATTLE_LINK';
    SELECT COUNT(*) INTO results_deleted FROM cleanup_audit WHERE action = 'DELETE_RESULT';
    
    SELECT COUNT(*) INTO matches_reset
    FROM scheduled_match sm
    WHERE sm.type = 'CW_DAILY'
      AND sm.status = 'PENDING'
      AND sm.score_a IS NULL;
    
    RAISE NOTICE '=================================================================';
    RAISE NOTICE 'AUTO-VINCULAR CLEANUP COMPLETED';
    RAISE NOTICE '=================================================================';
    RAISE NOTICE 'Battle links deleted: %', links_deleted;
    RAISE NOTICE 'Results deleted: %', results_deleted;
    RAISE NOTICE 'Matches reset to PENDING: %', matches_reset;
    RAISE NOTICE '';
    RAISE NOTICE 'All CW_DAILY matches are now ready for fresh auto-vincular attempt.';
    RAISE NOTICE '=================================================================';
END $$;

-- Display cleanup audit details
SELECT 
    match_date,
    player_nick,
    action,
    COUNT(*) as count
FROM cleanup_audit
GROUP BY match_date, player_nick, action
ORDER BY match_date DESC, player_nick;

-- Verify CW_DAILY matches are now in clean state
SELECT 
    DATE(sm.scheduled_from) as match_date,
    COUNT(*) as total_cw_daily,
    COUNT(CASE WHEN sm.status = 'PENDING' THEN 1 END) as pending_matches,
    COUNT(smr.scheduled_match_id) as matches_with_results,
    COUNT(*) - COUNT(smr.scheduled_match_id) as matches_without_results
FROM scheduled_match sm
LEFT JOIN scheduled_match_result smr ON smr.scheduled_match_id = sm.scheduled_match_id
WHERE sm.type = 'CW_DAILY'
GROUP BY DATE(sm.scheduled_from)
ORDER BY match_date DESC
LIMIT 15;

-- ============================================================================
-- COMMIT or ROLLBACK
-- ============================================================================
-- Review the output above before committing.
-- To commit: COMMIT;
-- To rollback: ROLLBACK;

-- For safety, defaulting to ROLLBACK (dry-run)
-- Uncomment COMMIT below and comment out ROLLBACK when ready:

-- COMMIT;
ROLLBACK;  -- DELETE THIS LINE and uncomment COMMIT above when ready to apply
