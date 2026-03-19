## Context

El bloque de progreso de dashboard muestra un texto temporal basado en fechas. Actualmente, esa leyenda se renderiza antes del inicio de duelos y confunde al usuario.

## Goals

- No mostrar leyenda de `x día(s) restantes` antes de `duel_start_date`.
- Cambiar el label fijo de progreso a `Progreso Duelos`.

## Non-Goals

- No cambiar cálculo de victorias/derrotas ni porcentaje de progreso.
- No cambiar endpoints de datos del dashboard.
- No cambiar reglas de fin de fase (`Fase de duelos finalizada`).

## Design Decisions

1. **Fuente de verdad de inicio y fin de duelos**
- Usar `profile.duelStartDate` para determinar el inicio (cuando mostrar leyenda de "comienza en X")
- Usar `profile.ladderStartDate` para determinar el fin (cuando mostrar leyenda de "X restantes")
- Usar `battlesPlayed >= TOTAL_BATTLES` para determinar completitud

2. **Regla de render de leyenda temporal — tres estados**
- **Antes de inicio:** Si `duelStartDate` es futura, mostrar "Fase de duelos comienza en X días"
- **Durante fase:** Si `duelStartDate` pasó pero no completó 20 batallas, mostrar "X días restantes"
- **Fase completada:** Si se jugaron 20 batallas, mostrar "Fase de duelos finalizada"

3. **Copy del bloque de progreso**
- Reemplazar `Progreso Temporada` por `Progreso Duelos`

## Risks and Mitigations

- **Riesgo:** diferencias por zona horaria en el inicio exacto del día.
- **Mitigación:** usar lógica consistente con la fecha recibida en perfil y comparación por timestamp en cliente.

## Test Plan

- Verificar dashboard con temporada donde `duelStartDate` es futura: no aparece leyenda de días restantes.
- Verificar dashboard con temporada en curso: el bloque muestra `Progreso Duelos` y mantiene progreso numérico.
- Ejecutar lint de `liga-jugador`.
