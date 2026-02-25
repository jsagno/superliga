# Playwright UI Testing Setup

Este proyecto utiliza [Playwright](https://playwright.dev/) para tests de UI end-to-end.

## Estructura
- Los tests se ubican en `tests/e2e/`.
- Los tests corren contra la app en `http://localhost:5173` (dev) o `http://localhost:4173` (preview).

## Comandos útiles

- `npm run test:e2e` — Corre todos los tests e2e (requiere que el server esté corriendo)
- `npm run test:e2e:ui` — Abre el modo UI de Playwright
- `npm run test:e2e:serve` — Lanza el build de preview y corre los tests automáticamente

## Variables de entorno para tests autenticados

Algunos tests (por ejemplo, lista de jugadores) requieren credenciales de admin:

- `PLAYWRIGHT_ADMIN_EMAIL`
- `PLAYWRIGHT_ADMIN_PASSWORD`

Si estas variables no están definidas, los tests autenticados se marcan como `skipped`.

## Política de desarrollo
- **Obligatorio:** Cada tarea de desarrollo debe incluir tests de UI relevantes en `tests/e2e/`.
- Los tests deben cubrir los flujos principales y validaciones de la página/feature modificada.
- El PR no será aceptado sin tests de UI para la funcionalidad entregada.

## Matriz mínima E2E (lean)

No es necesario testear todas las páginas en cada PR. Se exige cobertura por **flujo crítico** y por **impacto**.

### Baseline recomendado

1. **Autenticación admin**
	- Ruta: `/admin/login`
	- Validar login exitoso y redirección a `/admin`.

2. **Histórico de batallas (crítico)**
	- Ruta: `/admin/battles/history` (o alias `/admin/battles-history`)
	- Validar carga de página, filtros principales y estado de resultados.

3. **Flujo core de jugadores**
	- Rutas: `/admin/players`, `/admin/players/:playerId`
	- Validar carga de listado y navegación a edición.

4. **Flujo de temporadas/operación**
	- Rutas: `/admin/seasons`, `/admin/seasons/:seasonId`, `/admin/seasons/:seasonId/cup-matches`
	- Validar carga de temporada y al menos un flujo operativo (partidos programados o equivalente).

5. **Flujo de tabla/consulta**
	- Ruta: `/admin/seasons/:seasonId/group-standings` o `/admin/seasons/:seasonId/daily-points`
	- Validar render de datos y estados vacíos/espera.

6. **Regresión adyacente (mínimo 1)**
	- Elegir un flujo no modificado pero cercano al área impactada.
	- Ejemplo: si se cambia players, validar además `/admin` (dashboard) o `/admin/teams`.

### Regla de ejecución por PR

- Siempre correr: flujo afectado(s) + 1 regresión adyacente.
- Si se toca autenticación o rutas base: incluir login obligatorio.
- Si se toca data-fetching común (hooks/shared services): ampliar a 2 regresiones adyacentes.

## Primer test de ejemplo
Ver `tests/e2e/basic.spec.js` para un ejemplo básico.

---

Para más información, consultar la [documentación oficial de Playwright](https://playwright.dev/).
