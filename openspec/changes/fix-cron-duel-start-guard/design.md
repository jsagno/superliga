## Context

El cron `cron_clash_sync.py` procesa el battlelog de cada participante de la temporada activa y vincula batallas CW_Daily a registros `scheduled_match` mediante `process_daily_duel_battle`. Antes de crear el vínculo, se llama a `has_duel_phase_started_for_battle(battle_time, season_config)` para verificar que la batalla pertenece al periodo de duelos.

**Estado actual — bug:**

```python
def has_duel_phase_started_for_battle(battle_time, season_config):
    duel_start_dt = parse_season_datetime_utc(season_config.get("duel_start_date"))
    battle_game_day    = convert_to_game_day(battle_time, season_config)
    duel_start_game_day = convert_to_game_day(duel_start_dt, season_config)  # ← BUG
    return battle_game_day >= duel_start_game_day
```

`duel_start_date` es un campo `DATE` SQL (p. ej. `"2026-03-01"`). `parse_season_datetime_utc` lo convierte a `datetime(2026, 3, 1, 0, 0, 0, UTC)`.
Después, `convert_to_game_day` detecta que medianoche UTC < cutoff (default 10:00 UTC = 600 min), y devuelve el día **anterior**: `date(2026, 2, 28)`.

Resultado: `duel_start_game_day = 2026-02-28` cuando el usuario configuró `2026-03-01`. Batallas del `2026-02-28` (día previo al inicio real) pasan el guard y son vinculadas erróneamente.

Esto generó registros `scheduled_match_battle_link` y `scheduled_match` espurios. El fix anterior (`fix-jugador-virtual-daily-pending-false-positive`) mitigó los síntomas en la UI, pero no eliminó el origen.

## Goals / Non-Goals

**Goals:**
- `duel_start_date` es interpretado como el primer game day válido (no como un timestamp que requiere conversión).
- Ninguna batalla cuyo game day sea `< duel_start_date` debe producir un vínculo automático.
- Ninguna batalla cuyo game day sea `> duel_end_date` (si existe) debe producir un vínculo automático.
- El cambio es mínimo y quirúrgico: solo afecta `has_duel_phase_started_for_battle`.

**Non-Goals:**
- No modificar registros históricos ya mal vinculados (limpieza de datos: fuera de alcance).
- No cambiar la lógica de `convert_to_game_day` (función correcta para su propósito: asignar un timestamp de batalla a un game day).
- No afectar la UI ni el flujo de enlace manual.

## Decisions

### Decisión 1: Tratar `duel_start_date` como game day directo

**Alternativa A (elegida):** Extraer `.date()` del datetime parseado, sin pasar por `convert_to_game_day`:

```python
duel_start_game_day = duel_start_dt.date()  # 2026-03-01 → date(2026, 3, 1)
```

**Alternativa B:** Añadir una variante de `convert_to_game_day` que acepte fechas. Rechazada: sobrediseño, añade complejidad para un caso trivial.

**Alternativa C:** Sumar 1 hora al datetime antes de convertir. Rechazada: frágil, depende del valor de cutoff.

**Rationale:** `duel_start_date` es por definición el nombre del primer game day del duelo, no el instante de inicio. El concepto de "game day" ya está codificado en el campo: `DATE(2026-03-01)` == game day 1. No corresponde aplicar una segunda transformación de cutoff.

### Decisión 2: Agregar upper-bound guard con `duel_end_date`

Mientras la temporada esté `ACTIVE`, el cron puede intentar vincular batallas del battlelog que pertenecen a días posteriores al fin del periodo de duelos (p. ej. si se modifican fechas). Se añade la verificación simétrica:

```python
duel_end_raw = season_config.get("duel_end_date")
duel_end_dt  = parse_season_datetime_utc(duel_end_raw)
if duel_end_dt:
    duel_end_game_day = duel_end_dt.date()
    if battle_game_day > duel_end_game_day:
        return False
```

`duel_end_date` es opcional (puede ser `None`); si no existe, el upper-bound se omite.

### Decisión 3: Renombrar la función para reflejar su alcance real

La función pasa de verificar solo el inicio a verificar ambos límites. Se renombra a `is_battle_within_duel_phase` para mayor claridad semántica. Se actualiza el único call-site en `process_daily_duel_battle`.

## Risks / Trade-offs

- **[Bajo]** Si en producción existen batallas ya vinculadas de días pre-season, este fix no las elimina. → Aceptado como fuera de alcance; si se requiere limpieza, se hace con un script SQL separado.
- **[Bajo]** Cambiar el nombre de la función requiere actualizar todos los call-sites. → Solo hay uno (`process_daily_duel_battle`, línea ≈1035). Trivial.
- **[Ninguno]** El comportamiento para batallas dentro del rango de duelos no cambia.

## Migration Plan

1. Modificar `has_duel_phase_started_for_battle` → renombrar + implementar fix descrito.
2. Actualizar el call-site en `process_daily_duel_battle`.
3. Rollback: revertir el commit del cron. Sin cambio de schema, rollback instantáneo.
