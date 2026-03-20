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
