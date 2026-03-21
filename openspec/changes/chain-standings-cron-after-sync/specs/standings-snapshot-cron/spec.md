## MODIFIED Requirements

### Requirement: `standings-cron` remains a one-shot executable and supports chained invocation
El sistema SHALL mantener `packages/standings-cron/standings_cron.py` como una ejecución one-shot y permitir que sea invocado desde el cron principal como fase posterior al sync.

#### Scenario: Chained invocation reuses shared operational credentials
- **WHEN** el cron principal dispara `standings-cron` dentro del mismo ciclo
- **THEN** la invocación resuelve correctamente las credenciales Supabase requeridas por `standings-cron`
- **THEN** no requiere configuración manual independiente que rompa la cadena en producción

#### Scenario: One chained invocation executes exactly one standings refresh
- **WHEN** `standings-cron` es invocado por el cron principal
- **THEN** ejecuta exactamente una corrida completa de ledger + snapshot
- **THEN** termina el control de vuelta al orquestador principal sin introducir un loop adicional

#### Scenario: Existing standalone execution remains possible
- **WHEN** un operador necesita correr `python standings_cron.py` manualmente
- **THEN** el script sigue pudiendo ejecutarse manualmente como corrida one-shot
- **THEN** el modo encadenado no rompe el uso manual para debugging o backfill operacional
