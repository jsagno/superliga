## ADDED Requirements

### Requirement: Nuevo paquete standings-cron
El sistema SHALL tener un nuevo paquete `packages/standings-cron/` con un script Python plano `standings_cron.py` que calcula y persiste `player_standings_snapshot`.

#### Scenario: Estructura de archivos del paquete
- **WHEN** se crea el paquete
- **THEN** existe: `standings_cron.py`, `requirements.txt`, `.env.example`, `README.md`

### Requirement: Población de points_ledger desde duelos resueltos
### Requirement: Población de points_ledger desde partidos de competición resueltos
El cron SHALL leer `scheduled_match_result` para matches pertenecientes a competiciones `'Copa de Liga'` y `'Copa Revenge'` de la temporada activa y crear entradas en `points_ledger` con `source_type='COPA_LIGA'` o `'COPA_REVENGE'` (según el nombre de la competición) que no existan aún (idempotente via `ux_points_ledger_idempotent`).

#### Scenario: Identificación de competiciones copa
- **WHEN** el cron corre para una temporada activa
- **THEN** consulta `competition WHERE name IN ('Copa de Liga', 'Copa Revenge')` para obtener los `competition_id` relevantes
- **THEN** filtra `scheduled_match` por `competition_id IN (<ids copa>)` y `season_id = <temporada activa>`

#### Scenario: Entrada de match de copa ya existente no se duplica
- **WHEN** el cron corre dos veces con el mismo `scheduled_match_result` de copa
- **THEN** el segundo run no inserta duplicados (el upsert con `on_conflict=ux_points_ledger_idempotent` es no-op)

#### Scenario: Nuevo match de Copa de Liga resuelto genera entradas en el ledger
- **WHEN** existe un `scheduled_match_result` para un match de Copa de Liga sin entrada en `points_ledger`
- **THEN** el cron inserta una fila para `player_a_id` con `source_type='COPA_LIGA'`, `points=points_a` y `sub_key='player_a'`
- **THEN** si `player_b_id` existe, inserta una fila para `player_b_id` con `source_type='COPA_LIGA'`, `points=points_b` y `sub_key='player_b'`

#### Scenario: Nuevo match de Copa Revenge resuelto genera entradas en el ledger
- **WHEN** existe un `scheduled_match_result` para un match de Copa Revenge sin entrada en `points_ledger`
- **THEN** el cron inserta entradas equivalentes con `source_type='COPA_REVENGE'`

### Requirement: Población de points_ledger desde duelos resueltos
El cron SHALL leer `scheduled_match_result` para duelos `CW_DAILY` ya resueltos de la temporada activa y crear entradas en `points_ledger` con `source_type='CW_DAILY'` que no existan aún (idempotente via `ux_points_ledger_idempotent`).

#### Scenario: Entrada de duelo ya existente no se duplica
- **WHEN** el cron corre dos veces con el mismo `scheduled_match_result`
- **THEN** el segundo run no inserta duplicados (el upsert con `on_conflict='source_type,source_id,sub_key,...'` es no-op)

#### Scenario: Nuevo duelo resuelto genera entradas en el ledger
- **WHEN** existe un `scheduled_match_result` para un duelo `CW_DAILY` sin entrada en `points_ledger`
- **THEN** el cron inserta dos filas: una para `player_a_id` (`sub_key='player_a'`) y una para `player_b_id` si existe (`sub_key='player_b'`)

### Requirement: Cálculo y escritura de player_standings_snapshot
El cron SHALL calcular posiciones por scope `'LEAGUE'` y `'ZONE'` para cada zona de la temporada activa y upsertear `player_standings_snapshot`.

#### Scenario: Cálculo de points_total
- **WHEN** el cron calcula standings para un jugador
- **THEN** `points_total = season_zone_team_player.initial_points + SUM(points_ledger.points WHERE scope='PLAYER' AND player_id=X AND season_id=Y AND zone_id=Z)`
#### Scenario: Cálculo de points_total
- **WHEN** el cron calcula standings para un jugador
- **THEN** `points_total = season_zone_team_player.initial_points + SUM(points_ledger.points WHERE scope='PLAYER' AND player_id=X AND season_id=Y AND zone_id=Z AND source_type IN ('LIGA_BONUS','CW_DAILY','COPA_LIGA','COPA_REVENGE'))`

#### Scenario: Cálculo de posición por scope='LEAGUE'
- **WHEN** el cron calcula standings con scope='LEAGUE'
- **THEN** los jugadores se ordenan por `points_total DESC` dentro de su `league` (A, B o C)
- **THEN** `position` es el ordinal dentro de la liga (1=primero)

#### Scenario: Cálculo de posición por scope='ZONE'
- **WHEN** el cron calcula standings con scope='ZONE'
- **THEN** todos los jugadores de la zona se ordenan juntos por `points_total DESC`

#### Scenario: delta_position calculado respecto al snapshot anterior
- **WHEN** ya existe un snapshot previo para el jugador
- **THEN** `delta_position = posicion_anterior - posicion_nueva` (positivo = subió, negativo = bajó)

#### Scenario: Primera ejecución sin snapshot previo
- **WHEN** no existe snapshot previo para un jugador
- **THEN** `delta_position = 0`

### Requirement: Actualización de last_snapshot_at
El cron SHALL actualizar `season_zone.last_snapshot_at` con el timestamp UTC del momento de escritura del snapshot.

#### Scenario: last_snapshot_at se actualiza en cada run
- **WHEN** el cron termina de escribir el snapshot para una zona
- **THEN** `season_zone.last_snapshot_at = NOW() UTC`

### Requirement: Configuración via .env
El cron SHALL leer `SUPABASE_URL` y `SUPABASE_KEY` desde variables de entorno (`.env` en el directorio del paquete).

#### Scenario: Falta de variables de entorno aborta el proceso
- **WHEN** `SUPABASE_URL` o `SUPABASE_KEY` no están definidas
- **THEN** el script termina con error informativo antes de intentar conectar a Supabase
