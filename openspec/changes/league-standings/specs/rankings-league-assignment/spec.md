## MODIFIED Requirements

### Requirement: SeasonZoneRankings expone league e initial_points
La pantalla `SeasonZoneRankings.jsx` MUST permitir al admin ver y editar `league` e `initial_points` por jugador además del `ranking_seed` ya existente.

#### Scenario: Columna league visible como selector inline
- **WHEN** el admin abre la pantalla de rankings para una zona
- **THEN** cada fila de jugador muestra un selector de `league` con opciones A, B, C
- **THEN** el valor guardado en BD se pre-selecciona

#### Scenario: league sugerida automáticamente desde ranking_seed
- **WHEN** el admin reordena jugadores (cambia ranking_seed)
- **THEN** el sistema sugiere la liga resultante según rangos: seeds 1-6 → A, 7-12 → B, 13-20 → C
- **THEN** la sugerencia es editable manualmente antes de guardar

#### Scenario: Columna initial_points editable inline
- **WHEN** el admin abre la pantalla de rankings
- **THEN** cada fila tiene un input numérico para `initial_points`
- **THEN** el valor actual de BD se pre-carga

#### Scenario: Guardar persiste league e initial_points junto con ranking_seed
- **WHEN** el admin hace clic en "Guardar"
- **THEN** el sistema hace upsert de `season_zone_team_player` con los tres campos: `ranking_seed`, `league`, `initial_points`
- **THEN** se muestra confirmación de guardado
