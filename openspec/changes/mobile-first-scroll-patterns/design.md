## Context

`liga-jugador` usa BottomNav fija en pantallas protegidas. En varias vistas, la combinación de `min-h-screen`, paddings inferiores y contenedores internos con overflow produce doble scroll en mobile (scroll del documento + scroll del contenido). Además, filtros visibles de forma permanente consumen alto vertical crítico en pantallas pequeñas.

## Goals / Non-Goals

**Goals:**
- Unificar un patrón de layout mobile-first con altura de viewport estable y un único contenedor principal de scroll por vista.
- Preservar máximo espacio útil para datos (tablas/listas) moviendo filtros secundarios a drawer/modal.
- Reducir riesgo de regressions visuales mediante validación E2E en rutas de mayor tráfico.

**Non-Goals:**
- No se rediseña branding visual ni estructura funcional completa de cada pantalla.
- No se introducen cambios de backend, APIs ni base de datos.
- No se migran patrones de desktop-first; el foco es comportamiento mobile.

## Decisions

### Decisión 1: Patrón de altura viewport-safe en vistas protegidas
- **Elección:** usar contenedor raíz `h-[100dvh] overflow-hidden` y `main` en `h-full` con secciones `flex-1 min-h-0`.
- **Rationale:** evita expansión no controlada del documento al combinar barra fija inferior y contenido dinámico.
- **Alternativa considerada:** mantener `min-h-screen` + paddings fijos. Rechazada por propensión a doble scroll en Chrome mobile.

### Decisión 2: Un único punto de scroll por pantalla
- **Elección:** definir explícitamente qué contenedor scrollea (contenido principal o tabla/lista) y suprimir scroll redundante del documento.
- **Rationale:** mejora previsibilidad UX y evita conflictos de gestos.
- **Alternativa considerada:** permitir scroll anidado sin reglas. Rechazada por fricción en uso táctil.

### Decisión 3: Filtros secundarios en modal/drawer
- **Elección:** acción de filtro en header abre panel overlay con controles de zona/liga.
- **Rationale:** libera alto visible en la vista base y permite priorizar contenido.
- **Alternativa considerada:** mantener filtros inline. Rechazada por costo vertical en mobile.

### Decisión 4: Tablas compactas mobile-first
- **Elección:** `table-fixed`, anchos de columna explícitos, padding/tipografía compactos en mobile, sin overflow horizontal de documento.
- **Rationale:** preservar legibilidad sin sacrificar columnas clave.
- **Alternativa considerada:** ocultar columnas por defecto. Se reserva como fallback para dispositivos extremos si la compactación no alcanza.

## Risks / Trade-offs

- **[Riesgo]** Diferencias de comportamiento entre navegadores mobile con `100dvh`.
  - **Mitigación:** validar en Chrome/Android e iOS Safari; fallback a `min-h-screen` solo si se detectan regresiones críticas.
- **[Riesgo]** Cambios de layout podrían afectar tests E2E existentes por selectores/visibilidad.
  - **Mitigación:** actualizar tests por intención funcional (acciones de usuario), no por estructura rígida de DOM.
- **[Trade-off]** Mayor complejidad de layout en CSS/utilidades.
  - **Mitigación:** encapsular patrón reusable para reducir duplicación.

## Migration Plan

1. Definir patrón reusable de layout mobile protegido (wrapper + content + nav-safe area).
2. Aplicar patrón a `TablaPosiciones` y validar manual/E2E.
3. Aplicar patrón en `TablaEquipos`, `BatallasPendientes`, `HistorialBatallas`.
4. Ajustar pruebas E2E relevantes para verificar ausencia de doble scroll y flujo de filtros.
5. Rollback parcial por pantalla si aparece regresión (feature flag de clases/layout por componente).

## Open Questions

- ¿Se debe extraer un componente común tipo `MobileProtectedLayout` ahora o después del primer rollout en 2 pantallas?
- ¿Para viewports muy estrechos (<360px) conviene ocultar una columna secundaria en tablas de standings?
