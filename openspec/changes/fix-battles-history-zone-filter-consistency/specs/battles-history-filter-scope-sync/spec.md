## ADDED Requirements

### Requirement: Player filter scope follows selected zone
El sistema MUST limitar las opciones de jugador al alcance de la zona seleccionada para la temporada activa.

#### Scenario: Zone changes with player previously selected
- **WHEN** el administrador cambia la zona y el jugador seleccionado queda fuera de alcance
- **THEN** el filtro de jugador se reinicia a `Todos los jugadores`
- **AND** el listado se recarga con el nuevo alcance válido

### Requirement: Team filter scope follows selected zone
El sistema MUST limitar las opciones de equipo al alcance de la zona seleccionada para la temporada activa.

#### Scenario: Zone changes with team previously selected
- **WHEN** el administrador cambia la zona y el equipo seleccionado queda fuera de alcance
- **THEN** el filtro de equipo se reinicia a `Todos los equipos`
- **AND** el listado se recarga con filtros consistentes

### Requirement: Dependent filter resets avoid stale cross-zone state
El sistema MUST evitar estado residual de filtros dependientes al alternar entre `Todas las zonas` y zona específica.

#### Scenario: Toggle zone scope repeatedly
- **WHEN** el administrador alterna varias veces entre `Todas las zonas` y una zona específica
- **THEN** los filtros dependientes permanecen válidos para el alcance actual
- **AND** los resultados listados corresponden únicamente a los filtros visibles y activos
