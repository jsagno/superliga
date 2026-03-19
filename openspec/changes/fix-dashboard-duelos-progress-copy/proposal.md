## Why

En `liga-jugador` el Dashboard muestra la leyenda de cuenta regresiva (`x día(s) restantes`) incluso cuando la fase de duelos todavía no comenzó. Esto genera un estado engañoso para jugadores antes del inicio oficial de duelos.

## What Changes

- Ajustar la lógica visual del bloque de progreso para ocultar la leyenda de días restantes mientras `duel_start_date` sea futura.
- Renombrar el texto del bloque de `Progreso Temporada` a `Progreso Duelos`.
- Mantener el resto del comportamiento del indicador de progreso sin cambios.

## Capabilities

### New Capabilities
- `dashboard-duelos-progress-copy`: comportamiento de copy/visibilidad del progreso de duelos en dashboard de jugador.

### Modified Capabilities
- `dashboard-jugador`: ajuste de requisito visual en el bloque de progreso para fase previa al inicio de duelos.

## Impact

- Afecta frontend en `packages/liga-jugador/src/pages/DashboardJugador.jsx`.
- No introduce cambios de API ni esquema de base de datos.
- Impacto funcional acotado a copy y condición de render en UI.
