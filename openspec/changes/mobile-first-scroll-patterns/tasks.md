## 1. Foundation: Mobile Scroll Pattern

- [ ] 1.1 Definir un patrón reusable de layout mobile protegido (`100dvh`, `overflow-hidden`, `main h-full`, `min-h-0`).
- [ ] 1.2 Documentar guía de uso del patrón para vistas con BottomNav fija en liga-jugador.

## 2. TablaPosiciones: Scroll + Filter Drawer

- [ ] 2.1 Asegurar que `/tabla` use un único contenedor de scroll y elimine doble scroll de documento.
- [ ] 2.2 Mantener temporada seleccionada automáticamente (ACTIVA o inmediata anterior) sin control visible para usuario.
- [ ] 2.3 Mover filtros de zona/liga al panel modal/drawer accesible desde botón de filtro.
- [ ] 2.4 Ajustar tabla para ancho mobile (compactación de columnas y densidad visual) sin overflow horizontal de documento.
- [ ] 2.5 Verificar que el default inicial siga siendo zona/liga del jugador autenticado.

## 3. Rollout a Otras Pantallas de liga-jugador

- [ ] 3.1 Aplicar patrón de scroll mobile-first en `TablaEquipos`.
- [ ] 3.2 Aplicar patrón de scroll mobile-first en `BatallasPendientes`.
- [ ] 3.3 Aplicar patrón de scroll mobile-first en `HistorialBatallas`.

## 4. Quality Gates

- [ ] 4.1 Actualizar/crear pruebas E2E para validar ausencia de doble scroll en `/tabla`.
- [ ] 4.2 Agregar al menos una validación E2E por pantalla intervenida para detectar overflow vertical inesperado.
- [ ] 4.3 Ejecutar build/lint en liga-jugador y registrar evidencia de verificación.

## 5. OpenSpec Closure

- [ ] 5.1 Marcar tareas completadas durante la implementación.
- [ ] 5.2 Verificar coherencia final entre proposal/specs/design/tasks.
- [ ] 5.3 Preparar el change para archive cuando no queden tareas pendientes.
