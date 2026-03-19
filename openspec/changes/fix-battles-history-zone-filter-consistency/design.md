## Context

La pantalla de Battles History en liga-admin permite filtrar por temporada, zona, jugador, equipo, modo, RES y rango de fechas. Actualmente existe una inconsistencia observable al comparar resultados de `Temporada + Todas las zonas` frente a `Temporada + Zona 1`, lo que sugiere divergencias en el origen de datos o en la aplicación secuencial de filtros.

Este fix es cross-cutting porque involucra la capa de UI de filtros, la construcción del query y la consistencia de resultados presentados (conteo, paginación y filas).

## Goals / Non-Goals

**Goals:**
- Garantizar que `Todas las zonas` represente la unión correcta de zonas de la temporada seleccionada.
- Garantizar que seleccionar una zona específica sea un subconjunto coherente del dataset base de temporada.
- Sincronizar filtros dependientes (jugador/equipo) al cambiar zona para eliminar combinaciones inválidas.
- Preservar UX actual de la pantalla y paginación, corrigiendo únicamente consistencia funcional.

**Non-Goals:**
- Rediseñar layout o estilos de Battles History.
- Cambiar reglas de negocio de Extreme/Risky o RES fuera del alcance de zona/temporada.
- Introducir nuevas tablas o migraciones.

## Decisions

1. Definir dataset base único por temporada
- Decisión: construir la consulta sobre un dataset base delimitado por temporada; `zona` se aplica como filtro adicional opcional.
- Rationale: evita rutas de query distintas entre `Todas las zonas` y `Zona específica`.
- Alternativas:
  - Consultas separadas por modo de zona: descartada por riesgo de drift lógico.

2. Aplicar orden determinístico de filtros
- Decisión: aplicar filtros en orden estable (temporada -> zona -> jugador/equipo -> modo/RES -> fechas).
- Rationale: simplifica razonamiento y facilita pruebas reproducibles.
- Alternativas:
  - Orden dinámico por campo modificado: descartada por complejidad y mayor superficie de bugs.

3. Reset/sincronización de filtros dependientes al cambiar zona
- Decisión: cuando cambia zona, validar jugador/equipo seleccionados; si quedan fuera de alcance, limpiar selección a “Todos”.
- Rationale: elimina estados inválidos y discrepancias silenciosas.
- Alternativas:
  - Mantener valores inválidos y mostrar vacío: descartada por mala UX y confusión.

4. Validaciones de consistencia en pruebas
- Decisión: agregar pruebas que comparen resultados entre `Todas las zonas` y zona específica para misma temporada.
- Rationale: previene regresiones del bug reportado.
- Alternativas:
  - Solo validación manual: descartada por baja confiabilidad.

## Risks / Trade-offs

- [Risk] Ajustar query puede cambiar totales esperados en casos límite históricos.
  - Mitigation: validar con escenarios reales de temporada y comparar contra subset esperado por zona.

- [Risk] Reset automático de jugador/equipo puede sorprender al usuario.
  - Mitigation: mantener valores “Todos” por defecto y reflejar cambios de forma explícita en la UI.

- [Trade-off] Más lógica de consistencia en frontend incrementa complejidad moderada.
  - Mitigation: encapsular reglas de sincronización en funciones pequeñas y testeables.

## Migration Plan

1. Ajustar lógica de consulta del historial para usar dataset base por temporada.
2. Aplicar filtro de zona como refinamiento opcional sobre el mismo dataset.
3. Implementar sincronización de filtros dependientes (jugador/equipo) al cambiar zona.
4. Agregar/actualizar pruebas E2E y de servicio para consistencia de resultados.
5. Ejecutar validación local (lint/tests enfocadas) y comparar escenario reportado.
6. Rollback: revertir commit del fix si se detectan regresiones en filtros.

## Open Questions

- ¿La comparación de consistencia debe considerar exactamente los mismos filtros secundarios (modo/RES/fechas) para todos los casos de prueba automáticos?
- ¿Queremos mostrar en UI una indicación explícita cuando jugador/equipo fue reseteado por cambio de zona?
