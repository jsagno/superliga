-- Add start_date and end_date columns to season_zone_team_player table
-- This allows managing player replacements during a season

ALTER TABLE season_zone_team_player 
ADD COLUMN IF NOT EXISTS start_date DATE,
ADD COLUMN IF NOT EXISTS end_date DATE;

-- Add check constraint: end_date must be after start_date
ALTER TABLE season_zone_team_player
ADD CONSTRAINT check_start_end_dates 
CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date);

-- Add comment to document the purpose
COMMENT ON COLUMN season_zone_team_player.start_date IS 'Fecha de inicio del jugador en el equipo para esta temporada';
COMMENT ON COLUMN season_zone_team_player.end_date IS 'Fecha de fin del jugador en el equipo (NULL = activo)';

-- Create a view to easily see active players at any given date
CREATE OR REPLACE VIEW v_active_team_players AS
SELECT 
  sztp.*,
  p.name as player_name,
  p.nick as player_nick,
  t.name as team_name
FROM season_zone_team_player sztp
JOIN player p ON sztp.player_id = p.player_id
JOIN team t ON sztp.team_id = t.team_id
WHERE (sztp.start_date IS NULL OR sztp.start_date <= CURRENT_DATE)
  AND (sztp.end_date IS NULL OR sztp.end_date >= CURRENT_DATE);

COMMENT ON VIEW v_active_team_players IS 'Shows currently active players in teams (based on start_date and end_date)';

-- Function to check if a team has more than 8 active players at a given date
CREATE OR REPLACE FUNCTION check_max_active_players(
  p_team_id UUID,
  p_zone_id UUID,
  p_check_date DATE DEFAULT CURRENT_DATE
) RETURNS TABLE (
  active_count INT,
  exceeds_limit BOOLEAN,
  players JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::INT as active_count,
    COUNT(*) > 8 as exceeds_limit,
    jsonb_agg(
      jsonb_build_object(
        'player_id', sztp.player_id,
        'player_nick', p.nick,
        'player_name', p.name,
        'jersey_no', sztp.jersey_no,
        'start_date', sztp.start_date,
        'end_date', sztp.end_date
      )
    ) as players
  FROM season_zone_team_player sztp
  JOIN player p ON sztp.player_id = p.player_id
  WHERE sztp.team_id = p_team_id
    AND sztp.zone_id = p_zone_id
    AND (sztp.start_date IS NULL OR sztp.start_date <= p_check_date)
    AND (sztp.end_date IS NULL OR sztp.end_date >= p_check_date)
  GROUP BY sztp.team_id, sztp.zone_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_max_active_players IS 'Returns the count of active players for a team at a given date and whether it exceeds 8';
