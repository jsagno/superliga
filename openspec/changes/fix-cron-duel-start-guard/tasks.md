## 1. Implementación del fix en el cron

- [x] 1.1 En `cron_clash_sync.py`, reemplazar la lógica de `has_duel_phase_started_for_battle`: cambiar `duel_start_game_day = convert_to_game_day(duel_start_dt, season_config)` por `duel_start_game_day = duel_start_dt.date()` para tratar `duel_start_date` como game day directo.
- [x] 1.2 Agregar el upper-bound guard en la misma función: leer `duel_end_date` de `season_config`; si existe, calcular `duel_end_game_day = duel_end_dt.date()` y retornar `False` si `battle_game_day > duel_end_game_day`.
- [x] 1.3 Renombrar la función de `has_duel_phase_started_for_battle` a `is_battle_within_duel_phase` y actualizar su docstring para reflejar la semántica correcta (ambos límites verificados).
- [x] 1.4 Actualizar el call-site en `process_daily_duel_battle` (aprox. línea 1035) para usar el nuevo nombre `is_battle_within_duel_phase`.
- [x] 1.5 Mejorar el logging de rechazo: distinguir entre `pre-season` y `post-season` en el mensaje de log para facilitar el diagnóstico.

## 2. Verificación y PR

- [x] 2.1 Revisar manualmente que no existen otros call-sites de `has_duel_phase_started_for_battle` en el codebase.
- [x] 2.2 Ejecutar el cron en modo debug (`--verbose` o con logging DEBUG) contra la temporada activa y confirmar que batallas pre-season son rechazadas.
- [x] 2.3 Crear rama `fix/fix-cron-duel-start-guard`, commitear con mensaje `fix(cron): treat duel_start/end_date as game day boundaries in is_battle_within_duel_phase`.
- [x] 2.4 Abrir PR con evidencia de rechazo en logs para batallas fuera del rango de duelos.
