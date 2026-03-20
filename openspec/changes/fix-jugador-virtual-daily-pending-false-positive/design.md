## Context

El pending virtual de `CW_DAILY` se inyecta para cubrir dias sin registro explicito de scheduled_match. El bug aparecia cuando los calculos de dia por cutoff o la interpretacion del estado no detectaban correctamente que el duelo ya se habia jugado.

## Goals / Non-Goals

**Goals:**
- Suprimir falsos positivos de pending virtual en duelos diarios jugados.
- Mantener la regla de cutoff diario (09:50->09:50) como fuente de verdad.
- Garantizar consistencia entre dashboard y batallas pendientes.

**Non-Goals:**
- No cambiar scoring ni calculo de victorias/derrotas.
- No modificar tablas ni migraciones SQL.

## Decisions

1. Parseo robusto de timestamp
- Decision: normalizar entradas de fecha con espacio (`YYYY-MM-DD HH:mm:ss+00`) antes de calcular day key.
- Rationale: evita `Invalid Date` silencioso y desalineaciones de day-key.

2. Normalizacion de status
- Decision: evaluar estados con `trim().toUpperCase()`.
- Rationale: soporta variaciones ortograficas y de casing (`OVERRIDEN`, `OVERRIDDEN`).

3. Evidencia por battle_time linkeado
- Decision: no inyectar virtual pending si hay link diario cuyo `battle_time` cae en el battle-day actual.
- Rationale: el link de batalla real es evidencia mas fuerte que ventanas scheduled inconsistentes.

4. Fuente unica de pendientes para dashboard
- Decision: `fetchPendingMatchesSummary` reutiliza `fetchPendingMatches`.
- Rationale: elimina drift de logica entre vistas.

## Risks / Trade-offs

- [Riesgo] Incremento de consultas por validar links del dia -> Mitigacion: limite acotado a matches diarios del jugador.
- [Riesgo] Casos legacy con datos incompletos -> Mitigacion: fallback por status normalizado y resolved IDs.

## Migration Plan

1. Aplicar cambios en servicios de pending/day-key.
2. Verificar build de `liga-jugador`.
3. Validar visualmente que no aparezca "Rival por confirmar" cuando exista duelo diario jugado del dia.
