## 1. Query and Filter Consistency

- [x] 1.1 Auditar la lógica actual de construcción de query en Battles History para temporada y zona.
- [x] 1.2 Unificar el dataset base por temporada y aplicar zona como refinamiento opcional.
- [x] 1.3 Verificar que el conteo total y la paginación se recalculen correctamente al cambiar zona.

## 2. Dependent Filter Scope Sync

- [x] 2.1 Implementar validación de alcance de `jugador` cuando cambia zona.
- [x] 2.2 Implementar validación de alcance de `equipo` cuando cambia zona.
- [x] 2.3 Resetear filtros dependientes inválidos a estado `Todos` y recargar resultados.

## 3. UI Behavior and Empty States

- [x] 3.1 Garantizar que no queden filas stale al cambiar entre `Todas las zonas` y zona específica.
- [x] 3.2 Confirmar estado vacío determinístico para combinaciones sin resultados.

## 4. Validation

- [x] 4.1 Agregar/actualizar pruebas E2E para comparar `Temporada + Todas las zonas` vs `Temporada + Zona 1`.
- [x] 4.2 Agregar/actualizar pruebas para reseteo de filtros dependientes (jugador/equipo).
- [x] 4.3 Ejecutar lint y tests relevantes de liga-admin para este flujo.
