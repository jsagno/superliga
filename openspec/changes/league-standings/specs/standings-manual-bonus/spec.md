## ADDED Requirements

### Requirement: Pantalla de bonificaciones manuales en liga-admin
El sistema SHALL proveer una pantalla en liga-admin (`/admin/seasons/:seasonId/zones/:zoneId/bonus-points`) donde el admin puede crear entradas en `points_ledger` con `source_type = 'LIGA_BONUS'` para cualquier jugador de la zona.

#### Scenario: Admin crea bonificación positiva
- **WHEN** el admin selecciona un jugador, ingresa `points = 3` y notas "TOP 1 guerra" y confirma
- **THEN** se inserta una fila en `points_ledger` con `scope='PLAYER'`, `source_type='LIGA_BONUS'`, `points=3`, `is_reversal=false`, `player_id`, `season_id`, `zone_id` correctos

#### Scenario: Admin crea bonificación negativa
- **WHEN** el admin ingresa `points = -5` con una nota explicativa
- **THEN** se inserta con `points = -5`; el sistema no valida negativos: cualquier entero es válido

#### Scenario: Admin anula una bonificación existente
- **WHEN** el admin selecciona una entrada existente y elige "Anular"
- **THEN** se inserta una nueva fila con `is_reversal = true`, `reversed_ledger_id = <id original>`, `points = - (original points)`
- **THEN** la entrada original no se modifica (inmutable)

#### Scenario: Lista de entradas existentes es visible
- **WHEN** el admin abre la pantalla de bonus points para una zona
- **THEN** se muestran todas las entradas `points_ledger` de esa zona (`source_type = 'LIGA_BONUS'`), con columnas: jugador, puntos, notas, fecha, creado por, anulada (si aplica)

#### Scenario: Inmutabilidad de ledger
- **WHEN** el admin intenta editar directamente una entrada existente
- **THEN** el sistema NO permite edición; solo anulación + nueva entrada

### Requirement: Acceso restringido a roles admin
El sistema SHALL requerir rol `SUPER_USER` o `SUPER_ADMIN` para crear o anular entradas en `points_ledger` desde esta pantalla.

#### Scenario: Usuario sin rol admin es rechazado
- **WHEN** un app_user sin rol admin intenta crear una entrada de bonus
- **THEN** la operación falla con error de autorización (RLS de Supabase)
