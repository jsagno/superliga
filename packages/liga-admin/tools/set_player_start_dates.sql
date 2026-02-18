-- Script para asignar fecha de inicio 2026-01-15 a todos los jugadores sin fecha

-- Ver cuántos registros se van a actualizar
SELECT COUNT(*) as total_sin_fecha
FROM season_zone_team_player
WHERE start_date IS NULL;

-- Actualizar todos los registros sin start_date
UPDATE season_zone_team_player
SET start_date = '2026-01-15'
WHERE start_date IS NULL;

-- Verificar resultados
SELECT 
  COUNT(*) as total_jugadores,
  COUNT(CASE WHEN start_date IS NOT NULL THEN 1 END) as con_fecha_inicio,
  COUNT(CASE WHEN start_date IS NULL THEN 1 END) as sin_fecha_inicio
FROM season_zone_team_player;

-- Ver algunos ejemplos
SELECT 
  sztp.season_zone_team_player_id,
  p.nick,
  t.name as equipo,
  sztp.start_date,
  sztp.end_date
FROM season_zone_team_player sztp
JOIN player p ON p.player_id = sztp.player_id
JOIN team t ON t.team_id = sztp.team_id
LIMIT 10;
