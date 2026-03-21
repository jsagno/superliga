## 1. Orchestration Contract

- [x] 1.1 Definir la interfaz de ejecución one-shot que usará `packages/cron` para disparar `standings-cron`.
- [x] 1.2 Definir cómo se resuelven y comparten variables de entorno entre `cron` y `standings-cron`.
- [x] 1.3 Definir criterios de éxito/fallo por fase (`sync` vs `standings`).

## 2. packages/cron

- [x] 2.1 Insertar la fase standings inmediatamente después de `run_sync_once(...)` dentro del loop existente.
- [x] 2.2 Mantener un único `sleep(30 * 60)` al final del ciclo completo.
- [x] 2.3 Agregar logs explícitos de inicio/fin para cada fase y del ciclo total.
- [x] 2.4 Si standings falla, registrar error y continuar con el siguiente ciclo.
- [x] 2.5 Si sync falla de forma que aborta el ciclo, omitir standings en ese ciclo.

## 3. packages/standings-cron

- [x] 3.1 Asegurar que `standings-cron` siga siendo invocable en modo one-shot desde el cron principal.
- [x] 3.2 Ajustar el entrypoint o helpers necesarios para integración limpia sin duplicar loops.
- [x] 3.3 Documentar el modo encadenado de ejecución.

## 4. Verification

- [x] 4.1 Ejecutar una iteración completa y verificar el orden: sync -> standings -> espera.
- [x] 4.2 Simular fallo en standings y verificar que el loop principal no se cae.
- [x] 4.3 Verificar que no existan dos esperas de 30 minutos ni doble scheduling.
- [x] 4.4 Actualizar documentación operativa de ambos paquetes.

## 5. OpenSpec Closure

- [x] 5.1 Marcar tareas completas durante la implementación.
- [x] 5.2 Verificar coherencia final entre proposal, design, tasks y specs.
- [x] 5.3 Preparar archive del change cuando el rollout quede validado.
