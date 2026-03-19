## ADDED Requirements

### Requirement: Root URL redirects to admin login
El sistema MUST redirigir cualquier acceso a la raíz `/` de liga-admin hacia `/admin/login`.

#### Scenario: Direct navigation to root
- **WHEN** un usuario navega a `/`
- **THEN** la aplicación redirige a `/admin/login`
- **AND** la redirección usa reemplazo de historial para evitar volver a `/` con el botón atrás

### Requirement: Existing admin routes remain accessible
La redirección de raíz MUST NOT alterar el comportamiento de rutas existentes bajo `/admin`.

#### Scenario: Direct navigation to admin route
- **WHEN** un usuario navega directamente a `/admin`
- **THEN** se evalúa el flujo normal de autenticación/autorización para esa ruta
- **AND** no se produce una redirección intermedia innecesaria a `/`