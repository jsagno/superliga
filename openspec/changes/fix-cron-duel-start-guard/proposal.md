## Why

El cron de auto-link vincula batallas CW_Daily que ocurrieron **antes del inicio de la fase de duelos** de la temporada activa. Esto sucede porque `has_duel_phase_started_for_battle` pasa `duel_start_date` (un valor de tipo DATE, ya interpretado como medianoche UTC) por la función `convert_to_game_day`, que — dado que medianoche UTC < cutoff (10:00 UTC) — lo asigna al dia de juego **anterior**, permitiendo que batallas del día previo al inicio se vinculen erróneamente. Esta corrupción de datos fue la causa raíz del fix `fix-jugador-virtual-daily-pending-false-positive` (que solucionó los síntomas en la UI sin eliminar la fuente del problema en el cron).

## What Changes

- Corregir `has_duel_phase_started_for_battle` en `cron_clash_sync.py`: el campo `duel_start_date` **ya es** una fecha de juego (game day); no debe pasarse por `convert_to_game_day`. En su lugar, debe usarse directamente como `date` sin transformación.
- Extender la función para verificar también que la batalla no pertenece a un game day posterior a `duel_end_date` (upper-bound guard), evitando links de batallas post-temporada cuando ya existe una nueva temporada activa.
- Mejorar el logging de rechazo para indicar explícitamente el motivo (pre-season vs post-season).

## Capabilities

### New Capabilities
- `cron-duel-phase-boundary-guard`: El cron MUST NOT vincular batallas CW_Daily cuyo game day sea anterior a `duel_start_date` o posterior a `duel_end_date` de la temporada activa.

### Modified Capabilities
- None.

## Impact

- `packages/cron/cron_clash_sync.py` — función `has_duel_phase_started_for_battle` (y su docstring)
- Sin cambios en esquema de base de datos ni en frontend.
- Sin impacto en el flujo de enlace manual vía liga-admin.
