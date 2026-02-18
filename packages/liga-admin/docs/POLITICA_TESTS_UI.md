
# Política de tests de UI (Playwright)

A partir de enero 2026, es **obligatorio** incluir tests de UI automatizados con Playwright para toda nueva funcionalidad o corrección de bugs en el admin.


## Reglas
- Todo PR debe incluir tests de UI relevantes en `tests/e2e/` usando Playwright.
- El developer es responsable de agregar los tests de UI para cada feature, fix o refactor.
- Los tests deben validar los flujos principales y casos de error de la página/feature modificada.
- El script `npm run preview:agent` levanta el build en el puerto 5174 (usar este puerto en los tests automatizados).
- El script `npm run test:e2e:serve` sigue disponible para pruebas manuales.
- Si la feature no es testeable por UI, justificarlo explícitamente en el PR.

## Ejemplo de test
Ver `tests/e2e/basic.spec.js`.

## Recursos
- [Playwright Docs](https://playwright.dev/)
- [tests/e2e/README.md](../tests/e2e/README.md)

---

Actualizado: 2026-01-26
