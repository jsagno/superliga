-- Remove the unique constraint on jersey numbers to allow player replacements
-- This allows inactive and active players to have the same jersey number

-- Drop the existing unique constraint
ALTER TABLE season_zone_team_player 
DROP CONSTRAINT IF EXISTS season_zone_team_player_zone_id_team_id_jersey_no_key;

-- Verify the constraint is removed
SELECT 
    conname as constraint_name,
    contype as constraint_type
FROM pg_constraint
WHERE conrelid = 'season_zone_team_player'::regclass
  AND conname LIKE '%jersey%';

-- Show current state of the table
\d season_zone_team_player

-- Now you can have multiple players with the same jersey number as long as they're in different time periods
-- Example: Player A with jersey #5 from 2026-01-01 to 2026-03-31
--          Player B with jersey #5 from 2026-04-01 to NULL (active)
