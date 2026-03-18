# Producto: LIGA-JUGADOR (Portal del Jugador)

**Tipo de Producto**: Aplicación Web (SPA/PWA) Mobile-First  
**Estado**: 🟡 En Diseño  
**Versión**: 0.1  
**Repositorio**: `packages/liga-jugador/`  
**Change OpenSpec**: `docs/openspec/changes/liga-jugador/`

---

## Propósito

LIGA-JUGADOR es una **Single Page Application mobile-first** que permite a los **jugadores participantes de Liga Interna** acceder a su información personal de torneo sin depender de los administradores.

### Por Qué Existe

Los jugadores de Liga Interna carecen de visibilidad directa sobre:
- **Su posición en el ranking** (deben preguntar al admin o esperar posts en WhatsApp)
- **Batallas pendientes contra sus rivales** y los límites de tiempo para jugarlas
- **El historial de sus batallas jugadas** con posibilidad de verificar el resultado
- **La tabla de equipos** de su zona

El sistema ya tiene toda la data en Supabase (sincronizada por CRON). LIGA-JUGADOR es la **interfaz que conecta esa data con el jugador final**.

---

## Usuarios Objetivo

| Usuario | Necesidad Principal |
|---------|-------------------|
| **Jugador activo** | Ver su posición, batallas pendientes, vincular batallas propias |
| **Capitán de equipo** | Ver standings del equipo, rendimiento de su zona |

Liga-jugador es un portal de **solo lectura + acción limitada** (vincular batallas). Toda acción administrativa sigue en liga-admin.

---

## Pantallas del Portal

### 1. Login de Jugador (Google)
**Stitch ID:** `5d974919f0ef4fd0ba1facda157fd09a`

Pantalla de entrada única con autenticación Google OAuth. El acceso es restringido: solo los jugadores cuyo email haya sido pre-autorizado por un administrador pueden ingresar.

**Elementos UI:**
- Ícono de espadas (`sports_esports`) + "Bienvenido a la Arena"
- Subtítulo: "Liga Interna de Clash Royale"
- Botón "Continuar con Google" (OAuth)
- Aviso de acceso restringido con explicación
- Versión y "Powered by Internal League System"

---

### 2. Dashboard del Jugador
**Stitch ID:** `f7a60da1d5fc444b9bf13d7238c02280`

Vista personal de bienvenida y resumen de estado del jugador en la temporada activa.

**Elementos UI:**
- Header: "Bienvenido, [Nombre]" + notificaciones
- Sección contextual: "Zona X · Liga A/B"
- Barra de progreso de temporada: "Temporada N · X/20 · Y días para finalizar"
- Grid de 4 stats: Victorias 🏆 | Derrotas ✖ | Win Rate ⭐ | Ranking #N
- Sección "⚔ Batallas Pendientes" con vista previa de 2-3 próximas batallas
- Cada battle card: nombre rival, tipo, "Sin horario fijado" o countdown
- Bottom nav: Inicio | Calendario | Ranking | Clan

---

### 3. Tablas de Posiciones (Zonas / Liga A / Liga B)
**Stitch ID:** `bde972608291443190fe80ccffc82c8c`

Vista de clasificación individual de jugadores con capacidad de filtrar por temporada, liga y zona.

**Elementos UI:**
- Selector de temporada (dropdown "Temporada X")
- Tabs: Zonas | Liga A | Liga B
- Chips de zona: Todas | Zona 1 | Zona 2 | Zona 3 | Zona 4
- Fila de jugador: Posición | Avatar | Nombre | Puntos | Tendencia ↑↓= | W-L | Clan
- El jugador autenticado aparece resaltado con etiqueta "(Tú)" y auto-scroll a su posición
- Spinner de carga mientras se obtienen los datos

---

### 4. Tabla de Posiciones de Equipos
**Stitch ID:** `d4189a3869e9487cb64c11327c7d7f48`

Clasificación de equipos dentro de cada zona, con podio visual de los tres primeros.

**Elementos UI:**
- Selector de zona (tabs: Zona 1 | Zona 2 | Zona 3 | Zona 4)
- Podio "Líderes de Temporada": #2 izquierda, #1 centro, #3 derecha (con puntos y corona para el #1)
- Tabla general: # | Equipo | Pts (y W-L record secundario)
- Indicadores de tendencia por equipo
- El equipo del jugador autenticado está resaltado
- Bottom nav: Inicio | Tabla | Partidas | Perfil

---

### 5. Batallas Pendientes
**Stitch ID:** `a6eec8e65e024088875d3c8685765e60`

Lista de enfrentamientos programados que el jugador debe completar, con filtros y acciones.

**Elementos UI:**
- Header "Batallas Pendientes" + notificaciones + cambio de vista (grid/lista)
- Tabs de filtro: Todas | Copa de Liga 🏆 | Duelo Diario ⚔
- Por cada batalla pendiente:
  - Nombre del rival
  - Tipo de batalla + countdown ("Límite dentro de X días, Y horas, Z min")
  - Botón **Reportar** (✏) — para marcar incidencias
  - Botón **Vincular** (🔗) — abre panel de asociación de batallas
- Estado vacío cuando no hay batallas pendientes
- Bottom nav: Inicio | Batallas | Tabla | Perfil

---

### 6. Asociar Batallas (Panel "Vincular")
**Stitch ID:** `133ac58ba0a3448ea275c9387fd41cb2`

Panel/modal deslizable desde abajo que permite al jugador seleccionar batallas de su historial reciente y asociarlas a un enfrentamiento pendiente.

**Elementos UI:**
- Header: "Vinculando a: [nombre del rival]" + botón cerrar ✕
- Lista de batallas no vinculadas vs ese rival (últimas N):
  - Resultado: ✓ Victoria / ✗ Derrota (con color verde/rojo)
  - Score de coronas (ej. "3 - 1")
  - Tiempo relativo ("Hace 23 min")
  - **Icono Ojo 👁** → abre BattleDetailModal con el detalle completo
  - Checkbox de selección
- Footer: contador "Seleccionadas: X de Y" + botón "Vincular Batallas" (activo si ≥1)
- Subtítulo: "Mostrando últimas N batallas no vinculadas"

---

### 7. Histórico de Batallas Propias
**Stitch ID:** `dfd831b5ce054c28957e9ce253aced7d`

Historial completo de batallas jugadas por el jugador, filtrable y con acceso al detalle de cada batalla.

**Elementos UI:**
- Header "Histórico" + botón ← atrás
- Selector de temporada (dropdown)
- Tabs de tipo: Todos | Duelo de Guerra ⚔ | Copa de Liga 🏆 | Copa Revenge
- Estadísticas globales: Total | Victorias | Win Rate %
- Lista de "Batallas Recientes":
  - Tipo de batalla (ícono)
  - "vs. [nombre del rival]"
  - Score (ej. "2 - 0"), tipo específico, tiempo relativo
  - **Icono Ojo 👁** → abre BattleDetailModal con detalle completo de rondas y mazos
- Carga progresiva / infinite scroll con spinner "Cargando más batallas…"

---

### Transversal: BattleDetailModal (Icono Ojo)

Disponible desde las pantallas 6 y 7. Al hacer click en el **icono ojo** de cualquier batalla:

**Contenido:**
- Resultado general (Victoria/Derrota, score total de coronas)
- Tipo y modo de batalla
- Fecha y hora exacta
- Lista de rondas individuales con:
  - Número de ronda
  - Resultado (quién ganó)
  - Score de coronas
  - Mazo usado por cada jugador (con imágenes de cartas si disponibles)

Este componente es una adaptación del `BattleDetailModal` que ya existe en `liga-admin`.

---

## Capacidades

| ID | Capacidad | Estado |
|----|-----------|--------|
| `google-oauth-login` | Autenticación OAuth Google con control de acceso por email | 🔴 Pendiente |
| `player-dashboard` | Dashboard personal con stats y batallas pendientes resumidas | 🔴 Pendiente |
| `player-zone-standings` | Tabla de posiciones individuales con tabs Liga A/B y filtros | 🔴 Pendiente |
| `team-standings` | Tabla de posiciones de equipos con podio por zona | 🔴 Pendiente |
| `pending-battles-view` | Lista de batallas programadas pendientes con countdown | 🔴 Pendiente |
| `battle-linking` | Asociar batallas propias no vinculadas a un enfrentamiento pendiente | 🔴 Pendiente |
| `own-battle-history` | Historial personal con filtros de temporada y tipo | 🔴 Pendiente |
| `battle-detail-viewer` | Modal de detalle de batalla accesible con icono ojo | 🔴 Pendiente |

---

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Framework | React 19 + hooks |
| Build | Vite 7 |
| Router | React Router 7 |
| Estilos | Tailwind CSS 4 |
| Base de Datos | Supabase PostgreSQL (lectura + escritura limitada) |
| Auth | Supabase Auth (Google OAuth) |
| Real-time | Supabase Realtime subscriptions |
| Iconos | Lucide React |
| Linting | ESLint 9 |

---

## Acceso y Seguridad

- **Autenticación**: Google OAuth exclusivamente (no email/password)
- **Autorización**: La cuenta autenticada debe existir en `app_user` y estar vinculada a `player` mediante `app_user_player`
- **RLS**: Row Level Security en Supabase restringe cada jugador a sus propios datos
- **Lectura ajena**: No es posible acceder a datos de otros jugadores (excepto en tablas de posiciones públicas)
- **Escritura**: Solo la acción de vincular batallas está permitida al jugador

---

## Integración con Otros Sistemas

```
CRON (sincroniza batallas)
    ↓
Supabase PostgreSQL ←→ LIGA-ADMIN (admins)
                    ←→ LIGA-JUGADOR (jugadores) ← este producto
```

- **CRON**: Provee las batallas que el jugador consulta (solo lectura desde liga-jugador)
- **LIGA-ADMIN**: Gestiona jugadores, equipos, temporadas. Debe administrar el alta de `app_user` y el vínculo `app_user_player` para autorizar acceso a liga-jugador
- **Base de datos**: Compartida, separación de responsabilidades por RLS

---

## Diseños de Referencia

**Stitch Project ID:** `4206610767598271327`  
**Archivos locales:** `Screens/LigaInterna/jugador/`

| Pantalla | Archivo local |
|----------|--------------|
| Login | `login_de_jugador_(google)_.png` |
| Dashboard | `dashboard_del_jugador.png` |
| Tablas de Posiciones | `tablas_de_posiciones_(zonas,_ligas_a.png` |
| Tabla Equipos | `tabla_de_posiciones_de_equipos.png` |
| Batallas Pendientes | `batallas_pendientes_1.png` |
| Asociar Batallas | `batallas_pendientes_2.png` |
| Histórico | `histórico_de_batallas_propias.png` |

---

## Limitaciones Actuales (v0.1)

- ⚠️ No tiene vista de perfil de jugador ni edición de datos propios
- ⚠️ No tiene notificaciones push (planeado en fase 2)
- ⚠️ No tiene funcionalidad de calendario de partidos
- ⚠️ El botón "Reportar" batalla (marcar incidencia) está diseñado pero no implementado
- ⚠️ No tiene modo oscuro/claro configurable por el usuario (dark por defecto)
- ⚠️ No tiene soporte multi-idioma (español únicamente)
