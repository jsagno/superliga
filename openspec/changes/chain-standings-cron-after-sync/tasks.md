## 1. Orchestration Contract

- [ ] 1.1 Definir la interfaz de ejecución one-shot que usará `packages/cron` para disparar `standings-cron`.
- [ ] 1.2 Definir cómo se resuelven y comparten variables de entorno entre `cron` y `standings-cron`.
- [ ] 1.3 Definir criterios de éxito/fallo por fase (`sync` vs `standings`).

## 2. packages/cron

- [ ] 2.1 Insertar la fase standings inmediatamente después de `run_sync_once(...)` dentro del loop existente.
- [ ] 2.2 Mantener un único `sleep(30 * 60)` al final del ciclo completo.
- [ ] 2.3 Agregar logs explícitos de inicio/fin para cada fase y del ciclo total.
- [ ] 2.4 Si standings falla, registrar error y continuar con el siguiente ciclo.
- [ ] 2.5 Si sync falla de forma que aborta el ciclo, omitir standings en ese ciclo.

## 3. packages/standings-cron

- [ ] 3.1 Asegurar que `standings-cron` siga siendo invocable en modo one-shot desde el cron principal.
- [ ] 3.2 Ajustar el entrypoint o helpers necesarios para integración limpia sin duplicar loops.
- [ ] 3.3 Documentar el modo encadenado de ejecución.

## 4. Verification

- [ ] 4.1 Ejecutar una iteración completa y verificar el orden: sync -> standings -> espera.
- [ ] 4.2 Simular fallo en standings y verificar que el loop principal no se cae.
- [ ] 4.3 Verificar que no existan dos esperas de 30 minutos ni doble scheduling.
- [ ] 4.4 Actualizar documentación operativa de ambos paquetes.

## 5. OpenSpec Closure

- [ ] 5.1 Marcar tareas completas durante la implementación.
- [ ] 5.2 Verificar coherencia final entre proposal, design, tasks y specs.
- [ ] 5.3 Preparar archive del change cuando el rollout quede validado.
