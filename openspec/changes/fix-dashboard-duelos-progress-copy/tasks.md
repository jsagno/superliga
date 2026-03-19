## 1. Dashboard Copy and Visibility

- [x] 1.1 Cambiar label de `Progreso Temporada` a `Progreso Duelos` en `DashboardJugador`.
- [x] 1.2 Mostrar "Fase de duelos comienza en X" cuando `duelStartDate` aún no inició.
- [x] 1.3 Mostrar "Fase de duelos finalizada" cuando se alcanzó 20/20 batallas jugadas.
- [x] 1.4 Mostrar "X días restantes" cuando la fase está en progreso y no se completó.
- [x] 1.5 Mantener comportamiento existente para el resto de estados del bloque.

## 2. Validation

- [x] 2.1 Ejecutar lint en `packages/liga-jugador`.
- [x] 2.2 Verificar dashboard con temporada previa al inicio de duelos y sesión autenticada sin jugador activo usando Playwright.
- [x] 2.3 Verificar dashboard con duelos completados (20/20) using Playwright.
