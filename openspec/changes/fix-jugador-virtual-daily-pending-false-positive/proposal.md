## Why

En algunos jugadores, LIGA-JUGADOR mostraba un pending virtual de duelo diario ("Rival por confirmar") aun cuando el duelo del dia ya estaba jugado y vinculado. Esto genera confusion operativa y contradice el estado real de la temporada.

## What Changes

- Normalizar parseo de timestamps para soportar formato Postgres (`YYYY-MM-DD HH:mm:ss+00`) en calculos de battle-day con cutoff.
- Endurecer deteccion de estado resuelto en daily mediante normalizacion de `status` (`trim + uppercase`) y soporte consistente de variantes `OVERRIDDEN`/`OVERRIDEN`.
- Evitar inyeccion de pending virtual si existe al menos una batalla linkeada (`scheduled_match_battle_link`) cuyo `battle_time` pertenece al battle-day actual (cutoff-aware).
- Alinear dashboard summary con la misma fuente de pendientes de `/batallas` para evitar divergencias de UI.

## Capabilities

### New Capabilities
- `jugador-daily-pending-consistency`: El sistema MUST ocultar pendientes virtuales diarios cuando exista evidencia de duelo diario jugado/resuelto en el battle-day actual.

### Modified Capabilities
- None.

## Impact

- `packages/liga-jugador/src/services/scheduledMatchesService.js`
- `packages/liga-jugador/src/services/duelDayUtils.js`
- `packages/liga-jugador/src/services/dashboardService.js`
- Consistencia visual entre `/dashboard` y `/batallas` para pendientes diarios.
