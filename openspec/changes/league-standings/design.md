## Context

### Estado actual de la BD relevante

**Ya existe:**
- `points_ledger` — tabla de transacciones de puntos (`scope`, `source_type`, `is_reversal`, `generated_run_id`). Ningún código la escribe aún.
- `player_standings_snapshot` — tabla de snapshot (`season_id`, `zone_id`, `scope`, `league`, `position`, `points_total`, `wins`, `losses`, `delta_position`, `updated_at`). No se escribe aún.
- `v_player_standings_source` — vista que agrega jugadores + puntos (desde `points_ledger`) + W/L (desde `scheduled_match_result`). Lista.
- `season_zone.is_dirty_standings` / `last_snapshot_at` — flags para marcar cambios e indicar cuándo se calculó por última vez.
- `season_zone_team_player.league CHECK (league IN ('A','B'))` — solo dos valores, Liga C falta.
- `season_zone_team_player.ranking_seed` — orden numérico, editable con drag-drop en `SeasonZoneRankings.jsx`.

**Falta:**
- `season_zone_team_player.initial_points` — columna para AN (handicap de inicio).
- `league` constraint para 'C'.
- Proceso que escriba `points_ledger` por duelos (`CW_DAILY`) y permita escribir bonificaciones (`LIGA_BONUS`).
- Proceso que calcule y escriba `player_standings_snapshot`.
- Pantallas admin para gestionar todo lo anterior.

### Breakdown de columnas en la tabla de posiciones

| Columna UI | Campo DB | Fuente | Escritura |
|---|---|---|---|
| AN | `initial_points` | `season_zone_team_player.initial_points` | Manual (admin) |
| AC | SUM(points_ledger) WHERE source_type='LIGA_BONUS' | `points_ledger` | Manual (admin screen) |
| ⚔️ (duelos) | SUM(points_ledger) WHERE source_type='CW_DAILY' | `points_ledger` → cron standings | Auto (standings cron) |
| TOTAL | `player_standings_snapshot.points_total` | snapshot | standings cron |
| Columna UI | Campo DB | Fuente | Escritura |
|---|---|---|---|
| AN | `initial_points` | `season_zone_team_player.initial_points` | Manual (admin) |
| AC | SUM(points_ledger) WHERE source_type='LIGA_BONUS' | `points_ledger` | Manual (admin screen) |
| ⚔️ (duelos) | SUM(points_ledger) WHERE source_type='CW_DAILY' | `points_ledger` → cron standings | Auto (standings cron) |
| 🏆 (copa) | SUM(points_ledger) WHERE source_type IN ('COPA_LIGA','COPA_REVENGE') | `points_ledger` → cron standings | Auto (standings cron) |
| TOTAL | `player_standings_snapshot.points_total` | snapshot | standings cron |

## Goals / Non-Goals

**Goals:**
- Admin puede editar `league`, `ranking_seed` e `initial_points` en una sola pantalla.
- Admin puede agregar/anular bonificaciones manuales (`LIGA_BONUS`) por jugador.
- Nuevo cron de standings calcula posiciones y escribe `player_standings_snapshot` en schedule fijo (no en tiempo real).
- Liga-admin y liga-jugador leen el snapshot precalculado.
- Liga-jugador muestra tab Liga C y timestamp de última actualización.
- Liga-jugador usa selector de zona antes de los tabs de liga y renderiza la tabla con el mismo breakdown que liga-admin.
- Liga-admin y liga-jugador muestran el icono del team junto al jugador cuando existe logo disponible.

**Non-Goals:**
- No se calculan standings en tiempo real (siempre del snapshot).
- No se migran datos históricos de temporadas pasadas.
- Copa Liga / Copa Dobles / Warriors no son part de este change (source_types futuros).
- Copa Dobles / Warriors no son parte de este change (source_types futuros).
- Copa de Liga y Copa Revenge **SÍ son parte de este change** (ver columna 🏆 copa arriba).
- El cron de clash-sync (`packages/cron/`) no se modifica.

## Decisions

### Decisión 1: `initial_points` como columna en `season_zone_team_player`, no como ledger entry

**Alternativa A (elegida):** Columna directa `initial_points INT DEFAULT 0 NOT NULL`.

**Alternativa B:** Ledger entry con `source_type='INITIAL'` creada al asignar jugadores.

**Rationale:** AN es un valor de configuración del jugador en la temporada, no una transacción de puntos. Cambia cuando el admin reasigna/ajusta. Tenerlo en el ledger requeriría reversal cada vez que cambia. La columna es simple, directa, y el cron la agrega al total sin complejidad adicional.

### Decisión 2: El standings cron vive en `packages/standings-cron/` como script Python plano

**Rationale:** Consistente con el patrón del cron existente (`packages/cron/`). Flat file, `python standings_cron.py`, configurable con `.env`. No se justifica otro runtime.

### Decisión 3: `points_ledger` entries para `CW_DAILY` las escribe el standings cron (no el clash sync cron)

El cron de clash-sync ya genera `scheduled_match_result.points_a/b`. El standings cron lee esa tabla y genera entradas en `points_ledger` por duelos resueltos que aún no estén en el ledger (usando el índice `ux_points_ledger_idempotent` para idempotencia).

**Alternativa:** el clash-sync cron escribe también en points_ledger. Rechazada: separación de responsabilidades. El clash-sync sincroniza batallas; el standings cron agrega puntos.
### Decisión 3: `points_ledger` entries para `CW_DAILY` las escribe el standings cron (no el clash sync cron)

El cron de clash-sync ya genera `scheduled_match_result.points_a/b`. El standings cron lee esa tabla y genera entradas en `points_ledger` por duelos resueltos que aún no estén en el ledger (usando el índice `ux_points_ledger_idempotent` para idempotencia).

**Alternativa:** el clash-sync cron escribe también en points_ledger. Rechazada: separación de responsabilidades. El clash-sync sincroniza batallas; el standings cron agrega puntos.

### Decisión 5: UI de standings alineada entre admin y jugador

`AdminLeagueStandings.jsx` y `TablaPosiciones.jsx` comparten la misma semántica visual para las filas y el breakdown de puntos. En liga-jugador el flujo quedó: selector de temporada, selector de zona y recién después tabs A / B / C. La tabla muestra RNK, jugador con icono del team, AN, AC, ⚔️, 🏆, TOTAL, G y P.

### Decisión 6: El tab inicial se resuelve con la liga efectiva del jugador antes de cargar standings

La pantalla de liga-jugador no debe renderizar primero resultados de Liga A para luego corregirse a Liga B/C. La consulta inicial resuelve primero `playerContext.league` y usa esa liga efectiva en el fetch inicial para evitar estados intermedios inconsistentes o respuestas async viejas pisando el estado correcto.

### Decisión 7: `delta_position` en el snapshot

El standings cron guarda la posición anterior antes de reescribir, y calcula el delta. Si no había snapshot previo, delta = 0.

### Decisión 8: Identificación de competiciones Copa de Liga / Copa Revenge por nombre en tabla `competition`

El standings cron identifica las competiciones relevantes consultando `competition WHERE name IN ('Copa de Liga', 'Copa Revenge')`. La unión sigue la cadena: `competition` → `scheduled_match.competition_id` → `scheduled_match_result`. El lado del jugador se determina por `scheduled_match.player_a_id` / `player_b_id`; se usa `points_a` o `points_b` según corresponda.

Los `source_type` resultantes son `'COPA_LIGA'` (para matches de Copa de Liga) y `'COPA_REVENGE'` (para matches de Copa Revenge).

**Alternativa:** filtrar por `season_competition_config` o agregar columna `contributes_to_standings` a `competition`. Rechazada por sobreingeniería: los nombres de estas competiciones son estables y configurar por nombre es suficientemente explícito.

### Decisión 9: `points_total` incluye puntos de copa

`points_total = initial_points + SUM(points_ledger WHERE source_type IN ('LIGA_BONUS','CW_DAILY','COPA_LIGA','COPA_REVENGE'))`

La columna 🏆 copa en la UI muestra el desglose de copa por separado pero el TOTAL los incluye todos.

### Decisión 4: Schedule fijo para el standings cron; `last_snapshot_at` para el timestamp en UI

El campo `season_zone.last_snapshot_at` ya existe. El standings cron lo actualiza en cada run. Liga-admin y liga-jugador lo muestran como "Actualizado: DD/MM/YYYY HH:mm (hora Argentina)".


## Risks / Trade-offs

- **[Medio]** El standings cron necesita correr antes de que los datos sean visibles. Si el cron falla, el snapshot queda desactualizado. → Mitigación: mostrar `last_snapshot_at` claramente; el admin puede correr el cron manualmente.
- **[Bajo]** Migración de `initial_points` requiere DEFAULT 0 para no romper filas existentes. → Trivial.
- **[Bajo]** El constraint de `league` tiene que extenderse con una migración antes de que el admin pueda asignar Liga C. → Primera tarea del plan.

## Migration Plan

1. Supabase migration: añadir `initial_points`, ampliar constraint `league`.
2. New package `packages/standings-cron/`.
3. Modificar `SeasonZoneRankings.jsx` para `league` + `initial_points`.
4. Nueva página `SeasonBonusPoints.jsx` en liga-admin.
5. Nueva página `AdminLeagueStandings.jsx` en liga-admin.
6. Modificar `TablaPosiciones.jsx` en liga-jugador.
7. Rollback: revertir migración (si no hay datos en `initial_points`); desinstalar cron.
