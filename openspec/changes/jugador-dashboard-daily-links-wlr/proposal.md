## Why

En el dashboard de LIGA-JUGADOR, las metricas de victorias/derrotas pueden quedar desalineadas respecto a los duelos diarios realmente jugados y vinculados. Necesitamos calcular estas metricas a partir de todos los battle links de `CW_DAILY`, y ajustar el win rate segun la regla de puntos de liga (4 o 3 puntos = victoria).

## What Changes

- Calcular `wins` y `losses` del dashboard usando todos los `scheduled_match` de tipo `CW_DAILY` que tengan al menos un registro en `scheduled_match_battle_link` para el jugador.
- Resolver el resultado por duelo diario usando `scheduled_match_result.points_a/points_b` segun el lado del jugador en el match.
- Considerar victoria para win rate cuando los puntos del jugador en ese duelo sean `4` o `3`; en caso contrario, contabilizar derrota.
- Mantener `position`, `pointsTotal` y `deltaPosition` desde `player_standings_snapshot` sin cambios.
- Definir fallback seguro para casos sin resultados o sin links, evitando romper el dashboard.

## Capabilities

### New Capabilities
- `jugador-dashboard-daily-links-stats`: El dashboard MUST derivar victorias, derrotas y win rate desde los battle links de duelos diarios usando la regla de puntos de liga.

### Modified Capabilities
- None.

## Impact

- Afecta `packages/liga-jugador/src/services/dashboardService.js` en `fetchPlayerStats` y helpers de soporte.
- Impacta la exactitud de `StatsBadge` en `packages/liga-jugador/src/pages/DashboardJugador.jsx` sin cambios de UI.
- Puede requerir ajustes en pruebas E2E de dashboard cuando dependan de cifras hardcodeadas de wins/losses/winRate.
