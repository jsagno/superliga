## Context

`packages/cron/cron_clash_sync.py` ya implementa un loop continuo con `sleep(30 * 60)` entre ciclos. `packages/standings-cron/standings_cron.py`, en cambio, es un script one-shot que recalcula ledger + snapshots y termina. La necesidad actual no es agregar otro scheduler, sino insertar la ejecución de standings dentro del ciclo ya existente del cron principal.

## Goals / Non-Goals

**Goals:**
- Garantizar que después de cada ciclo exitoso de sync se ejecute una recalculación de standings antes de dormir 30 minutos.
- Mantener una única cadencia operativa de 30 minutos para todo el pipeline backend relacionado a sync + standings.
- Aislar errores de `standings-cron` para que no maten el loop principal.
- Evitar dependencia de un segundo scheduler externo para snapshots de standings.

**Non-Goals:**
- No rediseñar la lógica interna de cálculo de standings.
- No modificar reglas de puntos, snapshots o ledger.
- No introducir paralelismo entre sync y standings.
- No agregar cambios de base de datos ni nuevas tablas.

## Decisions

### Decision 1: El loop de `cron_clash_sync.py` será el scheduler único del pipeline
- **Choice:** conservar el `while True` actual de `cron_clash_sync.py` como fuente única de scheduling.
- **Rationale:** ya existe una cadencia estable cada 30 minutos; duplicarla con otro scheduler aumentaría drift operacional y complejidad de deploy.
- **Alternative considered:** mantener dos procesos separados coordinados por scheduler externo. Rechazada por riesgo de desalineación entre sync y snapshots.

### Decision 2: La secuencia del ciclo será `sync -> standings -> sleep`
- **Choice:** después de `run_sync_once(...)`, el proceso principal debe disparar una ejecución one-shot de standings y solo luego entrar en espera de 30 minutos.
- **Rationale:** asegura que los standings publicados reflejen el estado más fresco disponible al final del sync.
- **Alternative considered:** ejecutar standings antes del sync o en paralelo. Rechazada porque produce snapshots viejos o complejidad innecesaria.

### Decision 3: Si falla standings, el loop sigue vivo; si falla el sync completo, standings se omite en ese ciclo
- **Choice:** un fallo en la fase standings debe registrarse y no detener el proceso; un fallo que impida completar la fase sync aborta la fase standings de ese ciclo y pasa al sleep/retry normal.
- **Rationale:** standings depende del estado que deja sync; si sync no terminó correctamente, correr standings puede generar snapshots inconsistentes. En cambio, si standings falla, el sistema debe recuperarse solo en el siguiente ciclo.
- **Alternative considered:** intentar standings aun con sync abortado. Rechazada por riesgo de recalcular sobre datos incompletos.

### Decision 4: La integración debe preservar el modelo one-shot de `standings-cron`
- **Choice:** `standings-cron` debe seguir teniendo una unidad de ejecución única por ciclo (sin loop interno) y ser invocable desde el cron principal.
- **Rationale:** respeta la separación de responsabilidades: el cron principal orquesta; standings calcula snapshots una sola vez por invocación.
- **Alternative considered:** mover el loop a `standings-cron`. Rechazada porque el cron principal ya contiene la cadencia operativa y el sync sigue siendo la fase primaria.

### Decision 5: La orquestación debe resolver explícitamente el puente de configuración entre ambos paquetes
- **Choice:** el diseño debe contemplar que `packages/cron` usa `SUPABASE_SERVICE_ROLE_KEY` y `packages/standings-cron` usa `SUPABASE_KEY`, resolviendo ese bridge en la invocación o estandarizando la entrada.
- **Rationale:** hoy ambos scripts no leen exactamente el mismo nombre de variable para Supabase. Sin definir este puente, la cadena no es confiable.
- **Alternative considered:** asumir que ambos entornos siempre estarán duplicados manualmente. Rechazada por fragilidad operativa.

## Risks / Trade-offs

- **[Risk]** Un ciclo completo puede durar más que hoy porque agrega la fase standings.
  - **Mitigation:** medir duración por fase y loggear timings para verificar margen operativo dentro de la ventana de 30 minutos.
- **[Risk]** Si standings comparte el mismo proceso/entorno, un error de configuración puede aparecer recién al final del sync.
  - **Mitigation:** validar configuración de standings antes de invocarlo y emitir logs explícitos de fase.
- **[Trade-off]** Mantener dos paquetes separados con una cadena explícita requiere un pequeño puente de integración.
  - **Mitigation:** mantener interfaz one-shot clara y documentación operativa simple.

## Migration Plan

1. Extraer o definir una forma invocable de ejecutar `standings-cron` una sola vez por ciclo.
2. Modificar `cron_clash_sync.py` para insertar la fase standings después de `run_sync_once(...)`.
3. Ajustar logs y manejo de errores por fase.
4. Documentar que el job principal cubre sync + standings y evitar doble scheduling externo.
5. Validar manualmente una iteración completa del pipeline.

## Open Questions

- ¿La integración final debe ser vía import directo Python o vía subprocess con cwd/env del paquete `standings-cron`?
- ¿Conviene exponer un flag de feature (`ENABLE_STANDINGS_CHAIN=true`) para rollout gradual o el cambio debe ser inmediato?
