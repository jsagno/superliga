## 1. Routing and Entry Point

- [x] 1.1 Agregar ruta explícita para `/` que redirija a `/admin/login` con `replace`.
- [x] 1.2 Verificar que rutas existentes bajo `/admin` mantengan su comportamiento actual.

## 2. Shared Authentication Alignment

- [x] 2.1 Crear o ajustar servicio de autenticación en liga-admin con el mismo patrón base de liga-jugador (bootstrap de sesión, suscripción a cambios y resolución de identidad).
- [x] 2.2 Refactorizar `AuthContext` de liga-admin para consumir la capa de servicio y publicar estados de auth consistentes.

## 3. Role Gate Consistency

- [x] 3.1 Centralizar la decisión de autorización para roles `ADMIN`, `SUPER_ADMIN` y `SUPER_USER`.
- [x] 3.2 Aplicar la misma decisión de autorización en `LoginAdmin` y `ProtectedRoute`.
- [x] 3.3 Garantizar sign-out + mensaje de acceso denegado para usuarios autenticados sin rol permitido.

## 4. Validation

- [x] 4.1 Agregar/actualizar pruebas para redirección `/` -> `/admin/login`.
- [x] 4.2 Agregar/actualizar pruebas para acceso permitido de roles admin y denegación de roles no permitidos.
- [x] 4.3 Ejecutar lint y suites de prueba relevantes de `packages/liga-admin`.