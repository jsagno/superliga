## MODIFIED Requirements

### Requirement: Admin route authorization enforces allowed roles
El sistema MUST permitir acceso a rutas administrativas únicamente a usuarios autenticados con rol `ADMIN`, `SUPER_ADMIN` o `SUPER_USER`.

#### Scenario: Allowed admin role accesses protected route
- **WHEN** un usuario autenticado con rol permitido accede a una ruta protegida de admin
- **THEN** la ruta se renderiza correctamente
- **AND** no se muestra error de autorización

#### Scenario: Non-admin role attempts protected route access
- **WHEN** un usuario autenticado con rol no permitido accede a una ruta protegida de admin
- **THEN** el sistema deniega el acceso y redirige a `/admin/login`
- **AND** la sesión se invalida para evitar estado de autenticación ambiguo

### Requirement: Login flow applies the same role policy as protected routes
El login de admin MUST aplicar la misma política de autorización por rol usada por las rutas protegidas.

#### Scenario: Login with non-admin role
- **WHEN** un usuario completa autenticación válida pero su rol no está permitido
- **THEN** la aplicación ejecuta sign-out
- **AND** muestra un mensaje de acceso denegado
- **AND** evita navegación a páginas administrativas