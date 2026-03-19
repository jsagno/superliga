## Why
En Battles History de liga-admin, los resultados mostrados al filtrar por una temporada con `Todas las zonas` no son coherentes al comparar con la misma temporada filtrada por una zona específica (por ejemplo, `Zona 1`). Esta inconsistencia reduce la confianza en los datos operativos y afecta validaciones administrativas.

## What Changes
- Definir comportamiento consistente entre filtros `Temporada + Todas las zonas` y `Temporada + Zona específica`.
- Alinear la lógica de consulta para que el filtro por zona sea un refinamiento del mismo dataset base de temporada.
- Asegurar sincronización de opciones de jugador/equipo con la zona seleccionada, evitando combinaciones ambiguas.
- Agregar validaciones de UI y pruebas para detectar divergencias de conteo/listado entre filtros equivalentes.

## Capabilities
### New Capabilities
- `battles-history-zone-filter-consistency`: Garantiza consistencia de resultados entre vista global por temporada y vista por zona específica.
- `battles-history-filter-scope-sync`: Sincroniza el alcance de filtros dependientes (jugador/equipo) con la zona seleccionada para evitar estado inválido.

### Modified Capabilities
- None.

## Impact
- Código afectado en pantalla/admin de historial de batallas y servicio de consulta/filtros asociados.
- Impacto en consultas de datos y en reglas de composición de filtros de UI.
- Cobertura de pruebas E2E de filtros en Battles History.
- Sin cambios de esquema de base de datos ni migraciones.
