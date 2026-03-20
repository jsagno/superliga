## Context

La app de jugador ya dispone de `VincularBatallaPanel` y de servicios para consultar batallas no vinculadas y ejecutar vínculo. Sin embargo, las pantallas que renderizan pendientes (`DashboardJugador` y `BatallasPendientes`) no conectan la acción `Vincular` al panel, por lo que la capacidad existe pero no está expuesta al usuario final.

## Goals / Non-Goals

**Goals:**
- Exponer el flujo de vinculación en Dashboard y Batallas Pendientes.
- Reusar el panel/servicios existentes sin duplicar lógica.
- Limitar candidatos a batallas consistentes con la configuracion competitiva (modo) y rival del partido pendiente.
- Refrescar pendientes al completar vínculo.
- Respetar reglas de no vinculación para casos bloqueados (virtuales, impersonación).

**Non-Goals:**
- No rediseñar `VincularBatallaPanel`.
- No alterar schema de base de datos.

## Decisions

1. Estado local de panel por página
- Cada página (`DashboardJugador`, `BatallasPendientes`) controla `linkPanelOpen` y `selectedMatch`.
- `PendingBattleCard` dispara `onLink(match)` y la página abre panel con ese contexto.

2. Reutilización de callback de recarga existente
- Al confirmar vínculo (`onLinked`), se ejecuta `load/retry` de la página para refrescar lista y contador.
- No se mantiene estado optimista manual para reducir riesgo de inconsistencias.

3. Resguardo para casos no vinculables
- Si `match.linkDisabled` es true, el botón en card permanece deshabilitado (ya implementado).
- En modo impersonación, el panel mantiene solo lectura (comportamiento existente).

4. Filtro de candidatos basado en schema
- Para cada `scheduled_match`, resolver contexto con `season_id`, `competition_id`, `stage`, `player_a_id`, `player_b_id`.
- Resolver `api_game_mode` esperado desde `season_competition_config` por (`season_id`, `competition_id`, `stage`).
- Mostrar solo batallas (`battle`) con `api_game_mode` igual al esperado.
- Mostrar solo batallas donde participaron ambos jugadores del `scheduled_match`, usando `battle_round` + `battle_round_player`.
- Excluir batallas ya vinculadas en `scheduled_match_battle_link`.

## Risks / Trade-offs

- [Riesgo] Race condition al recargar tras vincular. → Mitigación: await en callback de recarga antes de cerrar panel cuando aplique.
- [Riesgo] Diferencias de datos entre dashboard (top 3) y lista completa. → Mitigación: cada vista refresca su propia fuente tras `onLinked`.
- [Riesgo] Falta de tests de integración del panel. → Mitigación: agregar E2E focalizado para apertura de panel y bloqueo de virtual/no vinculable.
