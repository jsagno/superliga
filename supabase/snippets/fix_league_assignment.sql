-- One-time data fix: assign league A/B/C to active season_zone_team_player rows
-- based on ranking_seed order within each zone.
-- Positions 1-6 → A, 7-12 → B, 13+ → C (matches inferLeague() in SeasonZoneRankings).
-- Safe to re-run; only touches active rows (end_date IS NULL).

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

-- Verify the distribution after running:
-- SELECT zone_id, league, COUNT(*) FROM public.season_zone_team_player WHERE end_date IS NULL GROUP BY 1, 2 ORDER BY 1, 2;
