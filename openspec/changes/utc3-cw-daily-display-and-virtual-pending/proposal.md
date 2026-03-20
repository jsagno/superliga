## Why

El CRON auto-vincula `CW_DAILY` con timestamps en UTC, pero en Cup Matches esos valores se interpretan visualmente con la zona horaria local del navegador, generando fechas inconsistentes para operación de liga. Adicionalmente, en LIGA-JUGADOR no existe una señal visual cuando el jugador no jugó su duelo diario y no hay registro pendiente reutilizable para vinculación.

## What Changes

- Mostrar `scheduled_from`, `scheduled_to` y `deadline_at` de `CW_DAILY` + `SW_Duel_1v1` en Cup Matches convertidos a UTC-3 para visualización.
- Mantener comportamiento actual para el resto de tipos/etapas de partido (sin conversión especial).
- Agregar pendiente visual virtual en LIGA-JUGADOR cuando no exista duelo diario jugado/registrado para el día vigente de duelos.
- Marcar ese pendiente virtual como no vinculable (solo informativo, sin escritura en base de datos).

## Capabilities

### New Capabilities
- `admin-cw-daily-utc3-display`: Renderizar fechas de `CW_DAILY`/`SW_Duel_1v1` en UTC-3 únicamente en la vista Cup Matches.
- `jugador-virtual-cw-daily-pending`: Exponer un pendiente virtual de duelo diario no jugado en LIGA-JUGADOR, sin persistencia y sin opción de vincular.

### Modified Capabilities
- None.

## Impact

- Afecta `packages/liga-admin/src/pages/admin/ScheduledMatches.jsx` (formateo de fechas/deadline en tarjetas de partidos).
- Afecta `packages/liga-jugador/src/services/dashboardService.js` y `packages/liga-jugador/src/services/scheduledMatchesService.js` (composición de pendientes virtuales).
- Afecta `packages/liga-jugador/src/components/PendingBattleCard.jsx` (estado no vinculable para pendientes virtuales).
- Afecta pruebas E2E/unit de ambos módulos donde aplique la lógica de visualización y pendientes.