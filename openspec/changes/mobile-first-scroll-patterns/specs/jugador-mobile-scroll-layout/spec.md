## ADDED Requirements

### Requirement: Single primary scroll container in mobile protected screens
El sistema SHALL usar un único contenedor principal de scroll por pantalla protegida de liga-jugador en mobile.

#### Scenario: No double vertical scroll in TablaPosiciones
- **WHEN** el usuario abre `/tabla` en viewport mobile
- **THEN** el documento principal no presenta doble scroll vertical por combinación de layout + tabla
- **THEN** el scroll vertical queda confinado al contenedor de datos cuando corresponde

#### Scenario: No double vertical scroll in BatallasPendientes
- **WHEN** el usuario abre `/batallas` en viewport mobile
- **THEN** la pantalla no genera scroll de documento adicional por padding/alturas acumuladas

#### Scenario: No double vertical scroll in TablaEquipos
- **WHEN** el usuario abre `/tabla/equipos` en viewport mobile
- **THEN** la pantalla mantiene altura visible utilizable con BottomNav fija sin overflow inesperado

#### Scenario: No double vertical scroll in HistorialBatallas
- **WHEN** el usuario abre `/historial` en viewport mobile
- **THEN** la pantalla preserva un único flujo de scroll vertical de contenido

### Requirement: Viewport-safe layout with fixed bottom navigation
Las pantallas protegidas de liga-jugador SHALL usar un layout viewport-safe (100dvh o equivalente) compatible con barra inferior fija.

#### Scenario: Protected view respects available height
- **WHEN** el usuario navega entre vistas protegidas en mobile
- **THEN** cada pantalla calcula su alto visible sin expandirse por encima del viewport real
- **THEN** BottomNav permanece fija sin tapar contenido crítico

### Requirement: Tables fit mobile width without page-level horizontal overflow
Las tablas de standings SHALL priorizar ajuste al ancho móvil evitando overflow horizontal del documento.

#### Scenario: TablaPosiciones avoids page horizontal overflow
- **WHEN** el usuario abre `/tabla` en viewport mobile
- **THEN** la tabla se renderiza dentro del ancho disponible de la vista
- **THEN** no aparece scroll horizontal a nivel de documento

#### Scenario: Data density remains readable
- **WHEN** la tabla presenta múltiples columnas en mobile
- **THEN** aplica densidad visual compacta (padding/tamaño tipográfico) conservando legibilidad y jerarquía de datos
