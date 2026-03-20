## ADDED Requirements

### Requirement: Tab Liga C en TablaPosiciones
El sistema SHALL mostrar un tercer tab "Liga C" en `TablaPosiciones.jsx` además de los existentes "Liga A" y "Liga B".

#### Scenario: Tab Liga C visible
- **WHEN** el jugador abre la pantalla de tabla de posiciones
- **THEN** existe un tab "Liga C" junto a "Liga A" y "Liga B"

#### Scenario: Tab Liga C muestra jugadores de liga C
- **WHEN** el jugador activa el tab "Liga C"
- **THEN** se muestran únicamente los jugadores con `league = 'C'` del scope `'LEAGUE'` del snapshot
- **THEN** el jugador actual es destacado si tiene `league = 'C'`

#### Scenario: Tab default es el de la liga del jugador actual
- **WHEN** el jugador abre la pantalla y su `league = 'C'`
- **THEN** el tab activo por defecto es "Liga C"

### Requirement: Timestamp de última actualización del snapshot
El sistema SHALL mostrar la fecha/hora de la última actualización del snapshot en la pantalla `TablaPosiciones.jsx`.

#### Scenario: Timestamp visible en UTC-3
- **WHEN** el snapshot tiene un `last_snapshot_at` disponible
- **THEN** se muestra "Actualizado: DD/MM/YYYY HH:mm (GMT-3)" en formato legible

#### Scenario: Sin datos de snapshot
- **WHEN** no hay snapshot disponible para la temporada/zona
- **THEN** no se muestra timestamp; se muestra vacío o "—"
