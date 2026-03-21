## Why

Las pantallas de liga-jugador tienen inconsistencias de scroll en mobile (doble scroll de página y contenedores internos), lo que reduce el espacio útil y degrada la navegación. Necesitamos un patrón unificado mobile-first para garantizar que el contenido principal use el máximo alto visible sin desbordes del viewport.

## What Changes

- Definir e implementar un patrón de layout mobile-first para pantallas protegidas de liga-jugador con `100dvh`, navegación inferior fija y un único contenedor principal de scroll.
- Estandarizar manejo de tablas en mobile: priorizar ajuste al ancho disponible, evitar scroll horizontal del documento y limitar el scroll al contenedor de datos cuando sea necesario.
- Estandarizar el patrón de filtros en mobile: mover filtros secundarios a panel modal/drawer para liberar área visible de contenido.
- Aplicar el patrón en las pantallas de mayor uso y riesgo de overflow (`TablaPosiciones`, `TablaEquipos`, `BatallasPendientes`, `HistorialBatallas`).
- Agregar cobertura E2E mínima de regresión visual/funcional para validar ausencia de doble scroll en las pantallas intervenidas.

## Capabilities

### New Capabilities
- `jugador-mobile-scroll-layout`: Define y aplica un patrón consistente de layout y scroll mobile-first en pantallas de liga-jugador, con viewport estable y navegación inferior fija.
- `jugador-mobile-filter-drawer`: Establece el patrón de filtros en modal/drawer para preservar alto útil del contenido y evitar saturación vertical en mobile.

### Modified Capabilities
- `jugador-liga-c-standings`: Ajusta comportamiento y layout de `TablaPosiciones` para integrarse al patrón mobile-first de scroll y filtros.

## Impact

- **Frontend (liga-jugador)**: cambios en composición de layout y clases Tailwind de páginas de tabla/historial/batallas.
- **Componentes compartidos**: posible extracción de wrapper/patrón reutilizable para vistas con BottomNav fija.
- **E2E (liga-jugador)**: actualización/creación de pruebas orientadas a overflow, scroll y accesibilidad de filtros en mobile.
- **Sin impacto en DB/APIs**: este cambio no modifica esquema ni contratos backend.
