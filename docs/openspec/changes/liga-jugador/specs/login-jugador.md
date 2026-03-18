# Feature: Login de Jugador (Google OAuth)

**Producto:** liga-jugador  
**Stitch Screen ID:** `5d974919f0ef4fd0ba1facda157fd09a`  
**Archivo objetivo:** `packages/liga-jugador/src/pages/LoginJugador.jsx`  
**Estado:** 🔴 Por implementar

---

## Descripción

Pantalla de entrada única para el portal del jugador. Utiliza **Google OAuth** como único método de autenticación. Después del login exitoso, el sistema verifica que el email del usuario esté registrado en el sistema antes de otorgar acceso.

---

## Diseño Visual

![Login](https://lh3.googleusercontent.com/aida/AOfcidXCFzn16TZh-trWRQa6yzb1YBz1iDbkzS2tsuoc79yj-bJjV2r4jQkuSkOMwNSD-4-DoaaRMiqNYL4ZIl3MeLlX4aYOVGtsQsBovjf1SkxmjnlSl3VPExzMSiKXDJhBlOcAvskqpGPDv3N0TDh_tqcUKdoGI2VXKwkwL8phRHmLF3Cg4HeOoriS3f4NdBz0cYGW3TZ6RGaR7itNRSoU0SxpESaNpqR9vx0z7UExOBnKzZGO5NKOiPq2RBw)

---

## Requerimientos Funcionales

### RF-LOGIN-01: Inicio de sesión con Google
- El usuario hace click en "Continuar con Google"
- Se abre un popup de Google OAuth (`supabase.auth.signInWithOAuth({ provider: 'google' })`)
- Supabase gestiona el token y crea/recupera la sesión

### RF-LOGIN-02: Verificación de jugador autorizado
- Después del login OAuth exitoso, el sistema hace **upsert** en `app_user` con `{ id: auth.users.id, email, full_name, role: 'PLAYER' }` (garantiza que el registro existe sin sobrescribir datos ya presentes)
- A continuación consulta `app_user_player` para resolver el vínculo `user_id → player_id`
- Si **existe vínculo** hacia `player.player_id`: guardar `app_user.id` y `player_id` en contexto local y redirigir a `/dashboard`
- Si **no existe vínculo**: mostrar mensaje "Acceso Restringido — tu cuenta no está vinculada a un jugador autorizado", hacer `signOut()` automáticamente

> **Nota de bootstrap:** El upsert en `app_user` permite que el administrador vea el nuevo usuario en `liga-admin` y establezca el vínculo en `app_user_player` sin necesidad de conocer el UUID de `auth.users` con anticipación. El jugador simplemente intenta acceder, el sistema registra su `app_user`, y el admin lo vincula al `player` correspondiente.

### RF-LOGIN-03: Redirección automática
- Si el usuario ya tiene una sesión activa (al visitar `/login`), redirigir automáticamente a `/dashboard`

### RF-LOGIN-04: Información de versión
- Mostrar versión de la app y "Powered by Internal League System" en el footer

---

## Requerimientos No Funcionales

- La pantalla debe ser la única página pública (accesible sin sesión)
- El botón de Google debe deshabilitarse mientras se procesa el login (prevenir doble click)
- El tiempo de respuesta del popup OAuth no es controlable por la app, pero el estado de carga debe indicarse

---

## Componentes UI

```
LoginJugador
├── [Ícono sports_esports centrado]
├── <h1> "Bienvenido a la Arena"
├── <p> "Liga Interna de Clash Royale"
├── [Logo/Imagen de la liga]
├── <button> "Continuar con Google"
│   └── [Ícono Google] + texto
├── <section> Aviso acceso restringido
│   ├── <LockIcon />
│   ├── <h3> "Acceso Restringido"
│   └── <p> "Para ingresar, tu correo de Google debe haber sido autorizado previamente..."
└── <footer> "v1.0.2 • Powered by Internal League System"
```

---

## Casos de Prueba

| # | Escenario | Resultado Esperado |
|---|-----------|-------------------|
| 1 | Usuario con email registrado hace login con Google | Redirige a `/dashboard` |
| 2 | Usuario con email NO registrado hace login con Google | Muestra "Acceso Restringido", hace signOut |
| 3 | Usuario con sesión activa visita `/login` | Redirige automáticamente a `/dashboard` |
| 4 | Usuario cierra popup de Google sin completar login | Permanece en login, sin errores críticos |
| 5 | Error de red durante el login | Muestra mensaje de error descriptivo |
