-- CLEANUP FOR TESTING: Delete today's daily duel battles and scheduled matches
-- Date: 2026-03-04
-- Purpose: Reset data to test CRON auto-linking implementation

-- WARNING: This script will DELETE data. Make a backup first!
-- Execution order matters due to foreign key constraints

BEGIN;

-- 1. Find today's game day boundaries
-- Using cutoff: 09:50 UTC (600 minutes from midnight)
-- Game day 2026-03-04 runs from 2026-03-04 09:50 UTC to 2026-03-05 09:50 UTC
WITH today_boundaries AS (
  SELECT 
    '2026-03-04'::date as game_day,
    '2026-03-04 09:50:00+00'::timestamptz as game_day_start,
    '2026-03-05 09:50:00+00'::timestamptz as game_day_end
)

-- 2. First, log what we're about to delete
SELECT 
  'BATTLES_TO_DELETE' as type,
  COUNT(*) as count,
  string_agg(battle_id::text, ', ') as ids
FROM battle
WHERE api_game_mode = 'CW_Duel_1v1'
  AND api_battle_type IN ('riverRaceDuel', 'riverRaceDuelColosseum')
  AND battle_time >= (SELECT game_day_start FROM today_boundaries)
  AND battle_time < (SELECT game_day_end FROM today_boundaries);

SELECT 
  'SCHEDULED_MATCHES_TO_DELETE' as type,
  COUNT(*) as count,
  string_agg(scheduled_match_id::text, ', ') as ids
FROM scheduled_match
WHERE type = 'CW_DAILY'
  AND DATE(scheduled_from) = '2026-03-04';

SELECT 
  'BATTLE_LINKS_TO_DELETE' as type,
  COUNT(*) as count
FROM scheduled_match_battle_link smbl
WHERE smbl.scheduled_match_id IN (
  SELECT scheduled_match_id FROM scheduled_match
  WHERE type = 'CW_DAILY' AND DATE(scheduled_from) = '2026-03-04'
);

SELECT 
  'MATCH_RESULTS_TO_DELETE' as type,
  COUNT(*) as count
FROM scheduled_match_result smr
WHERE smr.scheduled_match_id IN (
  SELECT scheduled_match_id FROM scheduled_match
  WHERE type = 'CW_DAILY' AND DATE(scheduled_from) = '2026-03-04'
);

-- 3. Delete in reverse dependency order

-- Delete match results first
DELETE FROM scheduled_match_result smr
WHERE smr.scheduled_match_id IN (
  SELECT scheduled_match_id FROM scheduled_match
  WHERE type = 'CW_DAILY' AND DATE(scheduled_from) = '2026-03-04'
);

-- Delete battle links from today's matches
DELETE FROM scheduled_match_battle_link smbl
WHERE smbl.scheduled_match_id IN (
  SELECT scheduled_match_id FROM scheduled_match
  WHERE type = 'CW_DAILY' AND DATE(scheduled_from) = '2026-03-04'
);

-- Delete today's scheduled matches
DELETE FROM scheduled_match
WHERE type = 'CW_DAILY' AND DATE(scheduled_from) = '2026-03-04';

-- Delete battle_round_player for today's battles
DELETE FROM battle_round_player brp
WHERE brp.battle_round_id IN (
  SELECT br.battle_round_id FROM battle_round br
  WHERE br.battle_id IN (
    SELECT battle_id FROM battle
    WHERE api_game_mode = 'CW_Duel_1v1'
      AND api_battle_type IN ('riverRaceDuel', 'riverRaceDuelColosseum')
      AND battle_time >= '2026-03-04 09:50:00+00'::timestamptz
      AND battle_time < '2026-03-05 09:50:00+00'::timestamptz
  )
);

-- Delete battle_round for today's battles
DELETE FROM battle_round br
WHERE br.battle_id IN (
  SELECT battle_id FROM battle
  WHERE api_game_mode = 'CW_Duel_1v1'
    AND api_battle_type IN ('riverRaceDuel', 'riverRaceDuelColosseum')
    AND battle_time >= '2026-03-04 09:50:00+00'::timestamptz
    AND battle_time < '2026-03-05 09:50:00+00'::timestamptz
);

-- Delete today's battles
DELETE FROM battle
WHERE api_game_mode = 'CW_Duel_1v1'
  AND api_battle_type IN ('riverRaceDuel', 'riverRaceDuelColosseum')
  AND battle_time >= '2026-03-04 09:50:00+00'::timestamptz
  AND battle_time < '2026-03-05 09:50:00+00'::timestamptz;

-- 4. Verify cleanup
SELECT 
  'VERIFY_BATTLES' as check_type,
  COUNT(*) as remaining_battles
FROM battle
WHERE api_game_mode = 'CW_Duel_1v1'
  AND api_battle_type IN ('riverRaceDuel', 'riverRaceDuelColosseum')
  AND battle_time >= '2026-03-04 09:50:00+00'::timestamptz
  AND battle_time < '2026-03-05 09:50:00+00'::timestamptz;

SELECT 
  'VERIFY_MATCHES' as check_type,
  COUNT(*) as remaining_matches
FROM scheduled_match
WHERE type = 'CW_DAILY' AND DATE(scheduled_from) = '2026-03-04';

SELECT 
  'VERIFY_LINKS' as check_type,
  COUNT(*) as remaining_links
FROM scheduled_match_battle_link smbl
WHERE smbl.scheduled_match_id IN (
  SELECT scheduled_match_id FROM scheduled_match
  WHERE type = 'CW_DAILY' AND DATE(scheduled_from) = '2026-03-04'
);

SELECT 
  'VERIFY_RESULTS' as check_type,
  COUNT(*) as remaining_results
FROM scheduled_match_result smr
WHERE smr.scheduled_match_id IN (
  SELECT scheduled_match_id FROM scheduled_match
  WHERE type = 'CW_DAILY' AND DATE(scheduled_from) = '2026-03-04'
);

COMMIT;

-- After running this, test the CRON auto-linking by:
-- 1. Running CRON sync with updated code
-- 2. Verifying new scheduled_match records created for today
-- 3. Checking that battles were linked automatically
-- 4. Validating that daily-points grid shows correct data
