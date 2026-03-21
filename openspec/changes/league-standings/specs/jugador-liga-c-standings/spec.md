## ADDED Requirements

### Requirement: Tab Liga C en TablaPosiciones
El sistema SHALL mostrar un tercer tab "Liga C" en `TablaPosiciones.jsx` además de los existentes "Liga A" y "Liga B".

#### Scenario: Selector de zona antes de tabs de liga
- **WHEN** el jugador abre la pantalla de tabla de posiciones
- **THEN** primero ve el selector de temporada, luego el selector de zona y debajo los tabs "Liga A", "Liga B" y "Liga C"

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

#### Scenario: Primera carga usa la liga correcta sin mostrar otra liga primero
- **WHEN** el jugador abre la pantalla y su `league = 'C'`
- **THEN** la primera carga de standings consulta y muestra directamente la Liga C sin requerir cambiar manualmente de tab

### Requirement: Tabla de standings alineada con liga-admin
El sistema SHALL mostrar en `TablaPosiciones.jsx` el mismo breakdown principal de datos que `AdminLeagueStandings.jsx` para la liga y zona seleccionadas.

#### Scenario: Filas muestran icono del team y breakdown de puntos
- **WHEN** el jugador abre la tabla de posiciones
- **THEN** cada fila muestra jugador con icono del team cuando existe logo
- **THEN** la tabla muestra columnas RNK, jugador, AN, AC, ⚔️, 🏆, TOTAL, G y P

### Requirement: Timestamp de última actualización del snapshot
El sistema SHALL mostrar la fecha/hora de la última actualización del snapshot en la pantalla `TablaPosiciones.jsx`.

#### Scenario: Timestamp visible en UTC-3
- **WHEN** el snapshot tiene un `last_snapshot_at` disponible
- **THEN** se muestra "Actualizado: DD/MM/YYYY HH:mm (GMT-3)" en formato legible

#### Scenario: Sin datos de snapshot
- **WHEN** no hay snapshot disponible para la temporada/zona
- **THEN** no se muestra timestamp; se muestra vacío o "—"
