## Why

LIGA-JUGADOR ya muestra el botón `Vincular` en cards de batallas pendientes, pero hoy no abre un flujo real de vinculación en Dashboard ni en la pantalla Batallas Pendientes. Esto genera una UX inconsistente frente a LIGA-ADMIN, donde sí existe panel de vinculación operativo.

## What Changes

- Habilitar flujo completo de vinculación desde cards pendientes en Dashboard.
- Habilitar flujo completo de vinculación desde cards pendientes en Batallas Pendientes.
- Reutilizar `VincularBatallaPanel` existente como modal/panel de selección y confirmación.
- Restringir candidatos de vinculación a batallas del `api_game_mode` configurado en `season_competition_config` para el `scheduled_match` activo.
- Restringir candidatos a batallas donde participaron los dos jugadores del `scheduled_match` (jugador + rival).
- Refrescar datos de pendientes después de vincular para reflejar cambios de estado.
- Mantener restricciones actuales: pendientes virtuales/no vinculables y modo impersonación de solo lectura.
- En `liga-admin` cup-matches, incluir estado `LINKED` en filtro de estado para visualizar partidos con batallas ya vinculadas.

## Capabilities

### New Capabilities
- `jugador-link-from-pending-cards`: Vinculación de batallas desde cards pendientes en dashboard y listado de pendientes, reutilizando panel de vinculación.

### Modified Capabilities
- None.

## Impact

- Afecta `packages/liga-jugador/src/pages/DashboardJugador.jsx` (estado del panel y callbacks de vinculación).
- Afecta `packages/liga-jugador/src/pages/BatallasPendientes.jsx` (estado del panel y callbacks de vinculación).
- Afecta `packages/liga-jugador/src/components/PendingBattleCard.jsx` (acción `onLink` ya existente se usa activamente).
- Reutiliza `packages/liga-jugador/src/components/VincularBatallaPanel.jsx` y `packages/liga-jugador/src/services/battlesService.js`.