## 1. Foundation: Mobile Scroll Pattern

- [x] 1.1 Definir un patrón reusable de layout mobile protegido (`100dvh`, `overflow-hidden`, `main h-full`, `min-h-0`).
- [x] 1.2 Documentar guía de uso del patrón para vistas con BottomNav fija en liga-jugador.

## 2. TablaPosiciones: Scroll + Filter Drawer

- [x] 2.1 Asegurar que `/tabla` use un único contenedor de scroll y elimine doble scroll de documento.
- [x] 2.2 Mantener temporada seleccionada automáticamente (ACTIVA o inmediata anterior) sin control visible para usuario.
- [x] 2.3 Mover filtros de zona/liga al panel modal/drawer accesible desde botón de filtro.
- [x] 2.4 Ajustar tabla para ancho mobile (compactación de columnas y densidad visual) sin overflow horizontal de documento.
- [x] 2.5 Verificar que el default inicial siga siendo zona/liga del jugador autenticado.

## 3. Rollout a Otras Pantallas de liga-jugador

- [x] 3.1 Aplicar patrón de scroll mobile-first en `TablaEquipos`.
- [x] 3.2 Aplicar patrón de scroll mobile-first en `BatallasPendientes`.
- [x] 3.3 Aplicar patrón de scroll mobile-first en `HistorialBatallas`.

## 4. Quality Gates

- [x] 4.1 Actualizar/crear pruebas E2E para validar ausencia de doble scroll en `/tabla`.
- [x] 4.2 Agregar al menos una validación E2E por pantalla intervenida para detectar overflow vertical inesperado.
- [x] 4.3 Ejecutar build/lint en liga-jugador y registrar evidencia de verificación.

## 5. OpenSpec Closure

- [x] 5.1 Marcar tareas completadas durante la implementación.
- [x] 5.2 Verificar coherencia final entre proposal/specs/design/tasks.
- [x] 5.3 Preparar el change para archive cuando no queden tareas pendientes.
