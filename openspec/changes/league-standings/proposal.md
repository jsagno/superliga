## Why

El proyecto necesita una funcionalidad completa de **tabla de posiciones por liga individual** (Liga A, Liga B, Liga C). Los datos base ya existen en la BD (`points_ledger`, `player_standings_snapshot`, vistas `v_player_standings_source`), pero ningún proceso los escribe ni ninguna pantalla administrativa los gestiona. El árbitro necesita asignar puntos iniciales y bonificaciones manuales (p.ej. top 3 en guerra); los jugadores necesitan ver su posición en su liga; y ambas apps necesitan consumir un snapshot precalculado en lugar de calcular en tiempo real.

## What Changes

- **DB Migration**: Agregar columna `initial_points INT DEFAULT 0` a `season_zone_team_player`. Extender constraint de `league` para incluir `'C'` (actualmente solo `'A'|'B'`).
- **liga-admin — Rankings/Assignment**: Edición inline de `league` y `ranking_seed` con sugerencia auto-derivada por rango (A=1-6, B=7-12, C=13-20). Edición de `initial_points` inline por jugador.
- **liga-admin — Manual Bonus Points**: Nueva pantalla para crear entradas en `points_ledger` (`scope='PLAYER'`, `source_type='LIGA_BONUS'`) con valor positivo o negativo, por jugador y temporada/zona.
- **liga-admin — League Standings Screen**: Nueva pantalla que muestra `player_standings_snapshot` agrupado por liga (A/B/C), con columnas AN, AC, puntos de duelo, TOTAL, RNK, y sello de última actualización.
- **liga-jugador — Liga C + last updated**: Agregar tab "Liga C" a `TablaPosiciones.jsx`. Mostrar datetime de última actualización del snapshot (UTC-3).
- **Nuevo paquete `packages/standings-cron/`**: Script Python plano que lee `v_player_standings_source`, calcula posiciones por scope (ZONE y LEAGUE), upsertea `player_standings_snapshot`, y actualiza `season_zone.last_snapshot_at`. Corre en schedule fijo.
- **Nuevo paquete `packages/standings-cron/`**: Script Python plano que lee `v_player_standings_source`, calcula posiciones por scope (ZONE y LEAGUE), upsertea `player_standings_snapshot`, y actualiza `season_zone.last_snapshot_at`. También procesa puntos de Copa de Liga y Copa Revenge desde `scheduled_match_result`. Corre en schedule fijo.

## Capabilities

### New Capabilities
- `standings-initial-points`: Admin configura puntos iniciales (`initial_points`) y liga (`league`) por jugador en la pantalla de rankings.
- `standings-manual-bonus`: Admin puede crear/anular entradas de bonificación manual en `points_ledger` (source_type='LIGA_BONUS').
- `admin-league-standings-screen`: Pantalla en liga-admin que muestra la tabla de posiciones por liga para una temporada/zona.
- `standings-snapshot-cron`: Nuevo paquete `packages/standings-cron/` que computa y persiste `player_standings_snapshot` en schedule fijo.
- `standings-snapshot-cron`: Nuevo paquete `packages/standings-cron/` que computa y persiste `player_standings_snapshot` en schedule fijo. Incluye ingesta de puntos de competición (Copa de Liga, Copa Revenge) como fuente `COPA_LIGA` / `COPA_REVENGE` en `points_ledger`.
- `jugador-liga-c-standings`: `TablaPosiciones.jsx` agrega tab Liga C y muestra timestamp de última actualización del snapshot.

### Modified Capabilities
- `rankings-league-assignment`: La pantalla `SeasonZoneRankings.jsx` ahora expone y persiste `league` e `initial_points` además del `ranking_seed` existente.

## Impact

- **DB**: Nueva migración con columna `initial_points` en `season_zone_team_player` + `league` constraint extendido a `'C'`.
- **packages/liga-admin/src/**: `SeasonZoneRankings.jsx` (modificado), nueva página `LeagueStandings.jsx`, nueva página `SeasonBonusPoints.jsx`, routing actualizado.
- **packages/liga-jugador/src/**: `TablaPosiciones.jsx` (tab C + last updated), `standingsService.js` (incluir `updated_at` en fetch).
- **packages/standings-cron/** (nuevo): `standings_cron.py`, `requirements.txt`, `.env.example`, `README.md`.
- **supabase/migrations/**: Una migración nueva.
- Sin cambios en el cron existente (`packages/cron/`).
