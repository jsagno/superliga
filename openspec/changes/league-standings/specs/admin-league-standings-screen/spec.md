## ADDED Requirements

### Requirement: Pantalla de standings por liga en liga-admin
El sistema SHALL proveer una pantalla en liga-admin (`/admin/seasons/:seasonId/zones/:zoneId/league-standings`) que muestra `player_standings_snapshot` agrupado por liga (A, B, C) para la temporada y zona seleccionadas.

#### Scenario: Tabla muestra columnas correctas
- **WHEN** el admin abre la pantalla de standings
- **THEN** se muestra una tabla por liga con columnas: RNK, jugador (nick + icono del team), AN, AC, ⚔️ (duelos), 🏆 (copa), TOTAL, Δ posición

#### Scenario: AN column muestra initial_points
- **WHEN** se renderiza una fila de la tabla
- **THEN** la columna AN muestra `season_zone_team_player.initial_points` del jugador

#### Scenario: AC column muestra suma de LIGA_BONUS
- **WHEN** se renderiza una fila de la tabla
- **THEN** la columna AC muestra la suma de `points_ledger.points` donde `source_type='LIGA_BONUS'` para ese jugador en esa temporada/zona

#### Scenario: Columna duelos muestra puntos CW_DAILY
- **WHEN** se renderiza una fila de la tabla
- **THEN** la columna ⚔️ muestra la suma de `points_ledger.points` donde `source_type='CW_DAILY'` para ese jugador

#### Scenario: Jugador muestra branding del team
- **WHEN** se renderiza una fila y el jugador tiene team con logo
- **THEN** el nombre del jugador se muestra junto al icono del team en la columna Jugador

#### Scenario: Columna copa muestra puntos de competición
- **WHEN** se renderiza una fila de la tabla
- **THEN** la columna 🏆 muestra la suma de `points_ledger.points` donde `source_type IN ('COPA_LIGA','COPA_REVENGE')` para ese jugador

#### Scenario: TOTAL viene del snapshot
- **WHEN** se renderiza la tabla
- **THEN** TOTAL = `player_standings_snapshot.points_total` (no se recalcula en el frontend)

#### Scenario: Timestamp de última actualización visible
- **WHEN** la pantalla está cargada
- **THEN** se muestra "Actualizado: DD/MM/YYYY HH:mm (GTM-3)" usando `season_zone.last_snapshot_at` convertido a UTC-3

#### Scenario: Snapshot no disponible
- **WHEN** `player_standings_snapshot` no tiene filas para la zona
- **THEN** la pantalla muestra un aviso "Sin datos — ejecutar el cron de standings"

### Requirement: Navegación desde pantalla de zona
El sistema SHALL proveer un enlace/botón en la pantalla de gestión de zona que lleve a la pantalla de standings.

#### Scenario: Link desde zona a standings
- **WHEN** el admin está en la pantalla de una zona
- **THEN** existe un botón "Ver Standings" que navega a `/admin/seasons/:seasonId/zones/:zoneId/league-standings`
