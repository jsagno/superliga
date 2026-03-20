## ADDED Requirements

### Requirement: Cron rechaza batallas pre-season por game day
El cron MUST NOT crear `scheduled_match_battle_link` para batallas cuyo game day (calculado con el cutoff configurado) sea **estrictamente anterior** a `season.duel_start_date`. El campo `duel_start_date` SHALL ser tratado como un game day calendar date directamente, sin aplicar `convert_to_game_day` sobre él.

#### Scenario: Batalla el día previo al inicio de duelos es rechazada
- **WHEN** el cron procesa una batalla CW_Daily con `battle_time = 2026-02-28T15:00:00Z` y la temporada activa tiene `duel_start_date = 2026-03-01` con `battle_cutoff_minutes = 600`
- **THEN** el game day de la batalla se calcula como `2026-02-28`
- **THEN** el cron NO crea ningún `scheduled_match_battle_link` para esa batalla
- **THEN** el log registra un mensaje de rechazo indicando `pre-season`

#### Scenario: Batalla antes del cutoff del día de inicio es rechazada
- **WHEN** el cron procesa una batalla con `battle_time = 2026-03-01T05:00:00Z` (antes del cutoff de 10:00 UTC) y `duel_start_date = 2026-03-01`
- **THEN** el game day de la batalla se calcula como `2026-02-28` (antes del cutoff → día anterior)
- **THEN** el cron NO crea ningún `scheduled_match_battle_link` para esa batalla

#### Scenario: Batalla justo en el cutoff del día de inicio es aceptada
- **WHEN** el cron procesa una batalla con `battle_time = 2026-03-01T10:00:00Z` (exactamente en el cutoff) y `duel_start_date = 2026-03-01`
- **THEN** el game day de la batalla se calcula como `2026-03-01`
- **THEN** el cron procede normalmente con el auto-link

#### Scenario: Batalla en un día posterior al inicio es aceptada
- **WHEN** el cron procesa una batalla con `battle_time = 2026-03-05T14:00:00Z` y `duel_start_date = 2026-03-01`
- **THEN** el cron procede normalmente con el auto-link

### Requirement: Cron rechaza batallas post-season por game day
El cron MUST NOT crear `scheduled_match_battle_link` para batallas cuyo game day sea **estrictamente posterior** a `season.duel_end_date`, cuando dicho campo esté disponible en la configuración de temporada.

#### Scenario: Batalla después del fin de duelos es rechazada
- **WHEN** el cron procesa una batalla con `battle_time = 2026-03-20T15:00:00Z` y la temporada tiene `duel_end_date = 2026-03-19`
- **THEN** el game day de la batalla se calcula como `2026-03-20`
- **THEN** el cron NO crea ningún `scheduled_match_battle_link`
- **THEN** el log registra un mensaje de rechazo indicando `post-season`

#### Scenario: Ausencia de duel_end_date no bloquea el proceso
- **WHEN** `season.duel_end_date` es `null` o no está presente en `season_config`
- **THEN** el upper-bound guard se omite y el cron continúa normalmente

#### Scenario: Batalla en el último día de duelos es aceptada
- **WHEN** el cron procesa una batalla con `battle_time = 2026-03-19T15:00:00Z` y `duel_end_date = 2026-03-19`
- **THEN** el game day de la batalla se calcula como `2026-03-19`
- **THEN** el cron procede normalmente con el auto-link
