## ADDED Requirements

### Requirement: Single cron cycle orchestrates sync and standings sequentially
El sistema SHALL usar el loop continuo de `packages/cron/cron_clash_sync.py` como orquestador único del ciclo `sync -> standings -> sleep(30 min)`.

#### Scenario: Standings runs immediately after a completed sync cycle
- **WHEN** `run_sync_once(...)` termina su ciclo normal
- **THEN** el proceso principal ejecuta una fase one-shot de `standings-cron`
- **THEN** la espera de 30 minutos ocurre solo después de terminar o intentar esa fase standings

#### Scenario: No second scheduler is required for standings
- **WHEN** el job principal de cron está activo
- **THEN** no se requiere un scheduler externo separado para recalcular standings
- **THEN** cada iteración del cron principal cubre sync y standings en el mismo ciclo operativo

### Requirement: Phase failures are isolated without killing the main loop
El sistema SHALL aislar fallos por fase para preservar la continuidad del loop de 30 minutos.

#### Scenario: Standings failure does not stop next cycle
- **WHEN** la fase standings falla después de un sync completado
- **THEN** el error se registra con contexto de fase
- **THEN** el proceso principal continúa vivo y vuelve a intentar en el siguiente ciclo luego de 30 minutos

#### Scenario: Sync cycle abort skips standings for that cycle
- **WHEN** ocurre un error que aborta la fase principal de sync antes de completarla
- **THEN** la fase standings no se ejecuta en ese ciclo
- **THEN** el proceso espera 30 minutos antes de reintentar un nuevo ciclo

### Requirement: Cycle logging differentiates sync and standings phases
El sistema SHALL emitir logs separados para inicio, fin, duración y fallo de las fases `sync` y `standings` dentro del mismo ciclo.

#### Scenario: Operator can identify phase boundaries in logs
- **WHEN** un operador revisa los logs del cron principal
- **THEN** puede distinguir claramente cuándo empezó y terminó la fase sync
- **THEN** puede distinguir claramente cuándo empezó y terminó la fase standings
- **THEN** puede ver si el sleep de 30 minutos ocurrió después de ambas fases
