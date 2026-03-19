## ADDED Requirements

### Requirement: Admin auth follows the liga-jugador method
Liga-admin MUST implementar el mismo método de autenticación base usado por liga-jugador para manejo de sesión y resolución de identidad.

#### Scenario: Session bootstrap on app load
- **WHEN** la aplicación inicializa el estado de autenticación
- **THEN** consulta la sesión activa desde Supabase con el mismo patrón de bootstrap aplicado en liga-jugador
- **AND** expone estados de autenticación consistentes para routing y UI

### Requirement: Auth state changes are handled consistently
Liga-admin MUST reaccionar a cambios de autenticación con el mismo enfoque de suscripción y actualización de estado aplicado en liga-jugador.

#### Scenario: Auth state change event
- **WHEN** Supabase emite un cambio de estado de auth (login, logout o refresh)
- **THEN** el estado de autenticación en liga-admin se actualiza de forma coherente y atómica
- **AND** las rutas protegidas reflejan inmediatamente el nuevo estado