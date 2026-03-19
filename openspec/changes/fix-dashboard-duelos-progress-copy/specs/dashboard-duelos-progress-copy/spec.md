## ADDED Requirements

### Requirement: Progress label uses duel wording
El bloque de progreso del dashboard de jugador MUST mostrar el texto `Progreso Duelos`.

#### Scenario: Label copy in dashboard
- **GIVEN** un jugador autenticado con dashboard cargado
- **WHEN** se renderiza el bloque de progreso
- **THEN** el texto visible del label es `Progreso Duelos`

### Requirement: Hide remaining-days legend before duel start
El dashboard MUST ocultar la leyenda `x día(s) restantes` cuando la temporada aún no llegó a `duel_start_date`.

#### Scenario: Future duel start date
- **GIVEN** un jugador con `duelStartDate` futura
- **WHEN** se renderiza el bloque de progreso
- **THEN** no se muestra la leyenda de `x día(s) restantes`
- **AND** se mantiene visible el progreso numérico (`wins + losses` sobre total)

#### Scenario: Duel phase started
- **GIVEN** un jugador con `duelStartDate` pasada o actual
- **WHEN** se renderiza el bloque de progreso
- **THEN** la leyenda temporal puede mostrarse según la lógica de días restantes vigente
