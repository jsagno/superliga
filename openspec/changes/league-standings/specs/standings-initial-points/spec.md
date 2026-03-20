## ADDED Requirements

### Requirement: initial_points column
El sistema SHALL tener una columna `initial_points INT DEFAULT 0 NOT NULL` en `season_zone_team_player` que almacena los puntos de inicio (AN) asignados a cada jugador por temporada/zona.

#### Scenario: Migración no rompe asignaciones existentes
- **WHEN** se aplica la migración con `initial_points INT DEFAULT 0 NOT NULL`
- **THEN** todas las filas existentes en `season_zone_team_player` quedan con `initial_points = 0`

#### Scenario: Admin guarda initial_points positivos
- **WHEN** el admin establece `initial_points = 5` para un jugador
- **THEN** el sistema persiste el valor 5 en `season_zone_team_player.initial_points`

#### Scenario: Admin guarda initial_points negativos
- **WHEN** el admin establece `initial_points = -2` para un jugador
- **THEN** el sistema persiste -2; no hay restricción de valor mínimo distinto de INT

#### Scenario: initial_points incluido en points_total del snapshot
- **WHEN** el standings cron calcula el total de puntos de un jugador
- **THEN** `points_total = initial_points + SUM(points_ledger.points WHERE player_id=X AND season_id=Y AND scope='PLAYER')`

### Requirement: league constraint incluye 'C'
El sistema SHALL aceptar los valores `'A'`, `'B'` y `'C'` para `season_zone_team_player.league`.

#### Scenario: Asignar jugador a Liga C es válido
- **WHEN** el admin guarda `league = 'C'` para un jugador
- **THEN** la BD acepta el valor sin error de constraint

#### Scenario: Valores fuera de A/B/C son rechazados
- **WHEN** se intenta insertar `league = 'D'`
- **THEN** la BD rechaza con error de CHECK constraint
