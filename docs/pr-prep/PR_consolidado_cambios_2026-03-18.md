# PR Consolidado de Cambios (2026-03-18)

## Objetivo
Este PR consolida todos los cambios locales actualmente funcionales en una sola rama para facilitar revisión, trazabilidad y merge a `main`.

## Rama de consolidación
- Rama base de trabajo: `feature/liga-jugador-standings`
- Rama consolidada creada: `chore/consolidado-cambios-2026-03-18`

## Resumen de requerimientos cubiertos

### 1) Liga Jugador: mejoras en flujo de batallas pendientes y navegación
**Estado:** Implementado parcialmente y con cobertura E2E inicial.

Cambios principales:
- Ajustes en navegación inferior y señalización de pendientes.
- Mejora de cards de batallas pendientes y UX asociada.
- Extensión de servicio de dashboard.
- Nuevo servicio para `scheduled_match`.
- Prueba E2E para batallas pendientes.

Archivos:
- `packages/liga-jugador/src/components/BottomNav.jsx`
- `packages/liga-jugador/src/components/PendingBattleCard.jsx`
- `packages/liga-jugador/src/pages/BatallasPendientes.jsx`
- `packages/liga-jugador/src/pages/DashboardJugador.jsx`
- `packages/liga-jugador/src/services/dashboardService.js`
- `packages/liga-jugador/src/services/scheduledMatchesService.js`
- `packages/liga-jugador/tests/e2e/batallas-pendientes.spec.js`
- `packages/liga-jugador/test-results/.last-run.json`

### 2) Liga Admin: historial de batallas y restricciones por variante de carta
**Estado:** En funcionamiento local.

Cambios principales:
- Refactors y mejoras en historial de batallas admin.
- Ajustes de UI y edición de restricciones de temporada.
- Soporte para variantes de restricción (normal, evolution, hero, all) en servicio/UI.
- Utilidades de parseo de cartas ampliadas.

Archivos:
- `packages/liga-admin/src/pages/admin/BattlesHistory.jsx`
- `packages/liga-admin/src/pages/admin/PlayerEdit.jsx`
- `packages/liga-admin/src/pages/admin/SeasonRestrictionEdit.jsx`
- `packages/liga-admin/src/pages/admin/SeasonRestrictions.jsx`
- `packages/liga-admin/src/components/CardGrid.jsx`
- `packages/liga-admin/src/components/RestrictionCard.jsx`
- `packages/liga-admin/src/services/restrictionsService.js`
- `packages/liga-admin/src/utils/cardParser.js`
- `packages/liga-admin/package.json`

### 3) Base de datos: migraciones para identidad Discord y restricción por variante
**Estado:** Scripts listos para aplicar.

Cambios principales:
- Migración para agregar `discord_user_id` a `player`.
- Migración para agregar `restriction_variant` en `season_card_restriction` con:
  - backfill de datos legacy,
  - constraint de dominio,
  - unique compuesto por variante,
  - índice de soporte.

Archivos:
- `supabase/migrations/20260305_add_discord_user_id_to_player.sql`
- `supabase/migrations/20260318000000_add_restriction_variant_to_season_card_restriction.sql`

### 4) CRON/Discord: mejoras de sincronización y notificaciones
**Estado:** Ajustado y alineado con cambios funcionales.

Archivos:
- `packages/cron/cron_clash_sync.py`
- `packages/cron/discord_messages.py`
- `packages/cron/discord_notifications.py`

### 5) OpenSpec y documentación
**Estado:** Actualizado para acompañar implementación.

Cambios principales:
- Actualización de changelog y referencias OpenSpec.
- Avance de tareas de `liga-jugador`.
- Artefactos de cambio OpenSpec creados (proposal/design/specs).
- Documentos de preparación de PR.

Archivos:
- `docs/openspec/README.md`
- `docs/openspec/changelog.md`
- `docs/openspec/changes/liga-jugador/tasks.md`
- `docs/openspec/changes/liga-jugador/.openspec.yaml`
- `docs/openspec/changes/liga-jugador/design.md`
- `docs/openspec/changes/liga-jugador/proposal.md`
- `docs/openspec/changes/liga-jugador/specs/batallas-pendientes.md`
- `docs/openspec/changes/liga-jugador/specs/battle-detail-modal.md`
- `docs/openspec/changes/liga-jugador/specs/dashboard-jugador.md`
- `docs/openspec/changes/liga-jugador/specs/historial-batallas.md`
- `docs/openspec/changes/liga-jugador/specs/login-jugador.md`
- `docs/openspec/changes/liga-jugador/specs/tabla-equipos.md`
- `docs/openspec/changes/liga-jugador/specs/tablas-posiciones.md`
- `docs/openspec/changes/liga-jugador/specs/vincular-batallas.md`
- `docs/openspec/products/liga-jugador.md`
- `docs/pr-prep/README.md`
- `docs/pr-prep/PR_liga-jugador-standings.md`
- `docs/pr-prep/PR_issue-4-playwright-login-timeout.md`
- `docs/PromptsForPosters.md`

### 6) Activos gráficos
Archivos:
- `logos/barcelona.jpeg`
- `logos/cobra.jpeg`

## Checklist para abrir PR a main
- [ ] Validar migraciones en entorno de desarrollo
- [ ] Ejecutar lint/tests de `liga-admin`, `liga-jugador`, y `cron`
- [ ] Adjuntar evidencia Playwright (flujo principal + regresión adyacente)
- [ ] Verificar que no haya secretos en commits
- [ ] Abrir PR desde `chore/consolidado-cambios-2026-03-18` hacia `main`

## Nota de seguridad de cambios locales
Todos los cambios locales quedaron preservados dentro de la rama de consolidación para evitar pérdida de trabajo antes del PR.
