## Why

Hoy `packages/cron/cron_clash_sync.py` y `packages/standings-cron/standings_cron.py` viven como procesos separados conceptualmente. El cron principal ya corre en un loop continuo cada 30 minutos, pero `standings-cron` sigue dependiendo de ejecución separada o manual. Eso deja una ventana donde la sincronización de batallas terminó, pero los snapshots de standings todavía no fueron recalculados.

Necesitamos que el proceso principal del cron se convierta en el orquestador de la cadena completa: primero sincronizar batallas, luego recalcular standings, y recién después dormir 30 minutos antes del siguiente ciclo.

## What Changes

- Encadenar `standings-cron` como fase posterior al ciclo actual de `cron_clash_sync.py`.
- Establecer que el loop de 30 minutos del cron principal sea la única cadencia operativa de referencia para sync + standings.
- Definir manejo de fallos por fase: si falla standings, el proceso principal sigue vivo y vuelve a intentar en el próximo ciclo; si falla el sync completo, no se ejecuta standings en ese ciclo.
- Definir cómo se comparten/configuran credenciales y contexto de ejecución entre `packages/cron` y `packages/standings-cron`.
- Documentar la nueva operación end-to-end para evitar doble scheduling externo.

## Capabilities

### New Capabilities
- `cron-post-sync-standings-chain`: Orquesta en un solo ciclo continuo la secuencia sync -> standings -> sleep(30 min), con aislamiento de errores por fase.

### Modified Capabilities
- `standings-snapshot-cron`: Permite que `standings-cron` sea ejecutado como fase encadenada del cron principal sin requerir un scheduler separado.

## Impact

- **Backend / Python**: cambios en `packages/cron/cron_clash_sync.py` y posiblemente en el entrypoint de `packages/standings-cron/standings_cron.py`.
- **Operación**: el scheduler externo deja de necesitar dos jobs separados para sync y standings; el job principal pasa a cubrir ambos.
- **Logging / observabilidad**: se deben diferenciar claramente las fases `sync` y `standings` dentro de cada ciclo de 30 minutos.
- **Sin impacto en DB schema**: no requiere migraciones ni cambios de modelo de datos.
