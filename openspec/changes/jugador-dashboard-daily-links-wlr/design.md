## Context

El dashboard actualmente obtiene `wins`, `losses` y `winRate` desde `player_standings_snapshot`. Para el caso de duelos diarios, se requiere una fuente mas precisa basada en actividad real vinculada (`scheduled_match_battle_link`) y en puntos efectivos del resultado (`scheduled_match_result`).

## Goals / Non-Goals

**Goals:**
- Calcular metricas de rendimiento del dashboard (victorias, derrotas, win rate) usando duelos diarios vinculados.
- Aplicar regla de negocio explicita: `points in {4,3}` se cuenta como victoria para win rate.
- Mantener la forma de respuesta de `fetchPlayerStats` para no romper consumidores.

**Non-Goals:**
- No modificar ranking/posicion global ni puntos totales del snapshot.
- No cambiar logica de listado de pendientes o vinculacion de batallas.
- No agregar nuevas tablas ni migraciones SQL.

## Decisions

1. Fuente de duelos computables
- Decision: usar `scheduled_match` filtrado por `season_id`, `type = CW_DAILY`, jugador en `player_a_id` o `player_b_id`, y existencia de link en `scheduled_match_battle_link`.
- Rationale: garantiza que solo cuenten duelos efectivamente jugados/vinculados.
- Alternativa considerada: contar por status (`LINKED/CONFIRMED`) sin links. Rechazada por menor fiabilidad.

2. Fuente de resultado por duelo
- Decision: usar `scheduled_match_result.points_a/points_b`, determinando el lado del jugador por `player_a_id`/`player_b_id`.
- Rationale: la regla pedida se define por puntos, no por score de rondas.
- Alternativa considerada: inferir resultado desde battle_round_player crowns. Rechazada por complejidad y posibles inconsistencias.

3. Politica de incompletos
- Decision: si un duelo vinculado no tiene `scheduled_match_result`, no se cuenta en wins/losses.
- Rationale: evita clasificaciones falsas hasta que exista resultado confirmado.
- Alternativa considerada: contar como derrota por defecto. Rechazada por sesgo negativo.

## Risks / Trade-offs

- [Riesgo] Duelo vinculado sin resultado queda fuera de metricas -> Mitigacion: fallback a valores snapshot cuando no hay duelos evaluables.
- [Riesgo] Mayor cantidad de consultas Supabase -> Mitigacion: seleccionar solo columnas necesarias y deduplicar IDs.
- [Riesgo] Diferencia temporal entre snapshot y resultados diarios -> Mitigacion: priorizar exactitud del requerimiento para dashboard diario.

## Migration Plan

1. Implementar helpers de agregacion diaria en `dashboardService`.
2. Integrar calculo en `fetchPlayerStats` manteniendo payload existente.
3. Validar con build de `liga-jugador` y `openspec validate` del cambio.
4. Si hay regression, rollback por commit revert del branch.

## Open Questions

- Si el producto desea mostrar tambien `totalEvaluados`, se puede agregar en un cambio posterior sin romper API actual.
