## ADDED Requirements

### Requirement: Progress label uses duel wording
El bloque de progreso del dashboard de jugador MUST mostrar el texto `Progreso Duelos`.

#### Scenario: Label copy in dashboard
- **GIVEN** un jugador autenticado con dashboard cargado
- **WHEN** se renderiza el bloque de progreso
- **THEN** el texto visible del label es `Progreso Duelos`

### Requirement: Show countdown before duel phase starts
El dashboard MUST mostrar leyenda de "Fase de duelos comienza en X" cuando `duelStartDate` es futura.

#### Scenario: Future duel start date
- **GIVEN** un jugador con `duelStartDate` futura
- **WHEN** se renderiza el bloque de progreso
- **THEN** se muestra la leyenda `Fase de duelos comienza en X día(s)`
- **AND** no se muestran leyendas de "restantes" o "finalizada"

### Requirement: Show remaining days during duel phase
El dashboard MUST mostrar "X días restantes" cuando la fase está en progreso y no se completó 20/20 batallas.

#### Scenario: Duel phase in progress
- **GIVEN** un jugador con `duelStartDate` pasada y `battlesPlayed < 20`
- **WHEN** se renderiza el bloque de progreso
- **THEN** se muestra la leyenda temporal según días al `ladderStartDate`
- **AND** la leyenda destaca en naranja si quedan 3 días o menos

### Requirement: Show completion message when all battles done
El dashboard MUST mostrar "Fase de duelos finalizada" cuando se alcanzó 20/20 batallas.

#### Scenario: Duel phase completed
- **GIVEN** un jugador con `battlesPlayed >= 20`
- **WHEN** se renderiza el bloque de progreso
- **THEN** se muestra el texto `Fase de duelos finalizada`
- **AND** no se muestran leyendas de "restantes" o "comienza en"
