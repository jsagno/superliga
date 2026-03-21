## 1. Base de datos

- [x] 1.1 Crear migración `supabase/migrations/<timestamp>_league_standings.sql`:
  - Agregar `initial_points INT DEFAULT 0 NOT NULL` a `season_zone_team_player`
  - Extender CHECK constraint de `league` para incluir `'C'` (DROP constraint + ADD constraint nueva)
- [ ] 1.2 Aplicar la migración al proyecto Supabase de desarrollo y verificar que no rompe datos existentes.

## 2. packages/standings-cron (nuevo)

- [x] 2.1 Crear directorio `packages/standings-cron/` con archivos: `standings_cron.py`, `requirements.txt`, `.env.example`, `README.md`.
- [x] 2.2 Implementar carga de config desde `.env` (`SUPABASE_URL`, `SUPABASE_KEY`). Abortar con error si faltan.
- [x] 2.3 Implementar función `populate_cw_daily_ledger(sb, season_id)`: lee `scheduled_match_result JOIN scheduled_match WHERE type='CW_DAILY'` y hace upsert en `points_ledger` con `source_type='CW_DAILY'` para cada player_a / player_b. Usar `on_conflict=ux_points_ledger_idempotent` para idempotencia.
- [x] 2.3b Implementar función `populate_competition_ledger(sb, season_id)`: consulta `competition WHERE name IN ('Copa de Liga', 'Copa Revenge')` para obtener IDs; lee `scheduled_match_result JOIN scheduled_match WHERE competition_id IN (<copa_ids>) AND season_id=<activa>`; upsert en `points_ledger` con `source_type='COPA_LIGA'` o `'COPA_REVENGE'` según el nombre de la competición, para `player_a_id` (con `points_a`) y `player_b_id` (con `points_b`). Idempotente via `ux_points_ledger_idempotent`.
- [x] 2.4 Implementar función `compute_standings(sb, season_id, zone_id)`: lee `v_player_standings_source` (o construye el query directo: `season_zone_team_player` + `SUM(points_ledger)` + `W/L`), calcula `points_total = initial_points + SUM(ledger WHERE source_type IN ('LIGA_BONUS','CW_DAILY','COPA_LIGA','COPA_REVENGE'))`, ordena por `points_total DESC`, asigna `position` y `delta_position` comparando con snapshot anterior.
- [x] 2.5 Implementar `write_snapshot(sb, season_id, zone_id, rows)`: upsert en `player_standings_snapshot` para scope=`'ZONE'` y scope=`'LEAGUE'` (separados). Actualizar `season_zone.last_snapshot_at = NOW()`.
- [x] 2.6 Implementar loop principal: para cada temporada `ACTIVE`, para cada zona, llamar `populate_cw_daily_ledger` → `populate_competition_ledger` → `compute_standings` → `write_snapshot`.
- [x] 2.7 Agregar logging con timestamps (como el cron existente). Incluir resumen al final: filas de ledger creadas, snapshots escritos.
- [ ] 2.8 Verificar ejecución manual (`python standings_cron.py`) contra el proyecto Supabase de desarrollo.

## 3. liga-admin — SeasonZoneRankings (modificado)

- [x] 3.1 Agregar columna `league` al estado y fetch de `season_zone_team_player` en `loadData()` (agregar `league, initial_points` al `.select()`).
- [x] 3.2 Agregar input numérico para `initial_points` por fila en la tabla de rankings.
- [x] 3.3 Agregar selector inline `<select>` para `league` (opciones A / B / C) por fila.
- [x] 3.4 Implementar auto-sugerencia de liga al reordenar: recalcular `league` para cada jugador según posición en la lista (1-6 → A, 7-12 → B, 13+ → C) y actualizar el estado local.
- [x] 3.5 Actualizar función `handleSave()` para incluir `league` e `initial_points` en el upsert batch.

## 4. liga-admin — SeasonBonusPoints (nueva pantalla)

- [x] 4.1 Crear `packages/liga-admin/src/pages/admin/SeasonBonusPoints.jsx` con ruta `/admin/seasons/:seasonId/zones/:zoneId/bonus-points`.
- [x] 4.2 Implementar formulario: selector de jugador (lista de `season_zone_team_player` para la zona), input numérico de puntos (positivo o negativo), textarea de notas, botón Guardar.
- [x] 4.3 Implementar `handleSubmit`: INSERT en `points_ledger` con `scope='PLAYER'`, `source_type='LIGA_BONUS'`, `is_reversal=false`, `created_by=currentUser.id`.
- [x] 4.4 Implementar lista de entradas existentes con columnas: jugador, puntos, notas, fecha, creado_por, estado (activa/anulada).
- [x] 4.5 Implementar botón "Anular" por entrada activa: INSERT nueva fila con `is_reversal=true`, `reversed_ledger_id=<original_id>`, `points = -original.points`.
- [x] 4.6 Agregar enlace a esta pantalla desde la navegación de zona en liga-admin.

## 5. liga-admin — AdminLeagueStandings (nueva pantalla)

- [x] 5.1 Crear `packages/liga-admin/src/pages/admin/AdminLeagueStandings.jsx` con ruta `/admin/seasons/:seasonId/zones/:zoneId/league-standings`.
- [x] 5.2 Implementar fetch de `player_standings_snapshot` con scope=`'LEAGUE'` para la zona. JOIN con `player` para nick. JOIN con `points_ledger` grouped por `source_type` para las columnas de breakdown (AN, AC, duelos).
- [x] 5.3 Implementar fetch de `season_zone.last_snapshot_at` y mostrarlo formateado como "Actualizado: DD/MM/YYYY HH:mm (GMT-3)".
- [x] 5.4 Renderizar tabla con tabs A / B / C. Por tab, mostrar filas con: RNK, Δ, jugador, AN, AC, ⚔️ duelos, 🏆 copa, TOTAL.
- [x] 5.5 Mostrar mensaje "Sin datos de snapshot" si `player_standings_snapshot` está vacío para la zona.
- [x] 5.6 Agregar enlace "Ver Standings" desde la pantalla de gestión de zona.

## 6. liga-jugador — TablaPosiciones (modificado)

- [x] 6.1 Agregar `{ key: 'C', label: 'Liga C' }` al array `VIEW_TABS` en `TablaPosiciones.jsx`.
- [x] 6.2 Actualizar lógica de tab default: si `playerContext.league === 'C'`, seleccionar tab `'C'` por defecto.
- [x] 6.3 Actualizar `standingsService.fetchPlayerStandings` (y/o `fetchSeasonZones`) para incluir `season_zone.last_snapshot_at`.
- [x] 6.4 Mostrar timestamp de última actualización en la UI convertido a UTC-3: "Actualizado: DD/MM/YYYY HH:mm (GMT-3)".
- [x] 6.5 Reordenar la UI para mostrar selector de zona antes de los tabs de liga y eliminar el selector de zonas dentro de cada liga.
- [x] 6.6 Alinear la tabla de liga-jugador con liga-admin: columnas AN, AC, ⚔️, 🏆, TOTAL, G, P e icono del team por fila.
- [x] 6.7 Corregir la carga inicial para que la primera consulta use la liga efectiva del jugador y no muestre momentáneamente otra liga.

## 7. Enrutamiento y navegación liga-admin

- [x] 7.1 Registrar las dos nuevas rutas en el router de liga-admin: `bonus-points` y `league-standings`.
- [x] 7.2 Verificar que los links de navegación desde la pantalla de zona funcionan correctamente.

## 8. Verificación final

- [ ] 8.1 Ejecutar standings cron manualmente; verificar que escribe en `player_standings_snapshot` y actualiza `last_snapshot_at`.
- [ ] 8.2 Verificar en liga-admin que SeasonZoneRankings guarda `league` e `initial_points` correctamente.
- [ ] 8.3 Verificar en liga-admin que SeasonBonusPoints crea y anula entradas en `points_ledger`.
- [ ] 8.4 Verificar en liga-admin que AdminLeagueStandings muestra standings con breakdown y timestamp.
- [x] 8.5 Verificar en liga-jugador que TablaPosiciones muestra tab Liga C y timestamp.
- [x] 8.6 Crear rama `feature/league-standings`, commitear, push y abrir PR.
