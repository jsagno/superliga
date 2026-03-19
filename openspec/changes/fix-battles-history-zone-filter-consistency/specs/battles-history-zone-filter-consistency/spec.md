## ADDED Requirements

### Requirement: Season dataset is consistent across zone scopes
El sistema MUST construir el listado de Battles History desde un único dataset base acotado por temporada.

#### Scenario: Same season with all zones vs specific zone
- **WHEN** el administrador selecciona una temporada y compara `Todas las zonas` contra `Zona 1` con los mismos filtros restantes
- **THEN** los resultados de `Zona 1` son un subconjunto coherente de `Todas las zonas`
- **AND** no aparecen batallas fuera de la temporada seleccionada

### Requirement: Zone filter acts as a refinement, not an alternate query path
El sistema MUST aplicar el filtro de zona como refinamiento sobre la consulta base de temporada.

#### Scenario: Switching from all zones to one zone
- **WHEN** el administrador cambia de `Todas las zonas` a una zona específica
- **THEN** el total de resultados no aumenta
- **AND** la paginación se recalcula sobre el subconjunto filtrado por zona

### Requirement: Empty state is deterministic when no battles match
El sistema MUST mostrar estado vacío consistente cuando la combinación de filtros no retorna batallas.

#### Scenario: No records for selected zone
- **WHEN** los filtros seleccionados no tienen batallas en la zona elegida
- **THEN** el listado muestra estado vacío
- **AND** no conserva filas de una selección previa de zona distinta
