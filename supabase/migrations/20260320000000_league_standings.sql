-- League Standings migration
-- Adds initial_points column and extends league constraint to include 'C'

-- 1. Add initial_points column to season_zone_team_player
ALTER TABLE public.season_zone_team_player
  ADD COLUMN IF NOT EXISTS initial_points integer NOT NULL DEFAULT 0;

-- 2. Extend league constraint to include 'C'
ALTER TABLE public.season_zone_team_player
  DROP CONSTRAINT IF EXISTS season_zone_team_player_league_check;

ALTER TABLE public.season_zone_team_player
  ADD CONSTRAINT season_zone_team_player_league_check
    CHECK (league = ANY (ARRAY['A'::text, 'B'::text, 'C'::text]));

-- 3. Data migration: assign league A/B/C based on ranking_seed order within each zone.
--    Positions 1-6 → A, 7-12 → B, 13+ → C (matches inferLeague() in SeasonZoneRankings).
--    Only updates active rows (end_date IS NULL) so historical/inactive players are untouched.
WITH ranked AS (
    SELECT
        season_zone_team_player_id,
        ROW_NUMBER() OVER (PARTITION BY zone_id ORDER BY ranking_seed) AS rn
    FROM public.season_zone_team_player
    WHERE end_date IS NULL
)
UPDATE public.season_zone_team_player sztp
SET league = CASE
    WHEN r.rn <= 6  THEN 'A'
    WHEN r.rn <= 12 THEN 'B'
    ELSE                 'C'
END
FROM ranked r
WHERE sztp.season_zone_team_player_id = r.season_zone_team_player_id;
