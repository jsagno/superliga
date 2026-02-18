# Playwright UI Testing Setup

Este proyecto utiliza [Playwright](https://playwright.dev/) para tests de UI end-to-end.

## Estructura
- Los tests se ubican en `tests/e2e/`.
- Los tests corren contra la app en `http://localhost:5173` (dev) o `http://localhost:4173` (preview).

## Comandos útiles

- `npm run test:e2e` — Corre todos los tests e2e (requiere que el server esté corriendo)
- `npm run test:e2e:ui` — Abre el modo UI de Playwright
- `npm run test:e2e:serve` — Lanza el build de preview y corre los tests automáticamente

## Política de desarrollo
- **Obligatorio:** Cada tarea de desarrollo debe incluir tests de UI relevantes en `tests/e2e/`.
- Los tests deben cubrir los flujos principales y validaciones de la página/feature modificada.
- El PR no será aceptado sin tests de UI para la funcionalidad entregada.

## Primer test de ejemplo
Ver `tests/e2e/basic.spec.js` para un ejemplo básico.

---

Para más información, consultar la [documentación oficial de Playwright](https://playwright.dev/).
