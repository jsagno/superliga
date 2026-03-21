## ADDED Requirements

### Requirement: Secondary filters in mobile use overlay drawer/modal pattern
En mobile, los filtros secundarios SHALL abrirse desde una acción explícita (ícono de filtro) en un overlay drawer/modal, en lugar de ocupar espacio permanente en la vista.

#### Scenario: TablaPosiciones filter panel opens from top-right action
- **WHEN** el usuario toca el botón de filtro en la cabecera de `/tabla`
- **THEN** se abre un panel modal/drawer con los filtros de zona y liga

#### Scenario: Filter panel does not alter base page height
- **WHEN** el panel de filtros está cerrado
- **THEN** la vista base no reserva alto adicional para controles secundarios
- **THEN** el área visible de datos es máxima para el viewport mobile

#### Scenario: Filter panel is dismissible and accessible
- **WHEN** el panel de filtros está abierto
- **THEN** el usuario puede cerrarlo por acción explícita de cierre y por tap fuera del panel
- **THEN** el panel expone atributos semánticos de diálogo accesible

### Requirement: Current-context default filters remain preserved
El sistema SHALL mantener como default la zona y liga del jugador autenticado aunque los controles se presenten en panel de filtros.

#### Scenario: Default zone and league are preserved after opening screen
- **WHEN** el usuario abre `/tabla`
- **THEN** la data inicial corresponde a su zona y liga actuales
- **THEN** abrir/cerrar el panel de filtros no resetea ese contexto por defecto
