# Diseño Técnico: Liga Jugador — Portal del Jugador

## Contexto

Liga Interna ya opera con dos sistemas bien establecidos:
- **CRON** (`packages/cron`): sincroniza batallas de la API de Supercell a Supabase
- **LIGA-ADMIN** (`packages/liga-admin`): SPA React para administradores, usa el mismo stack tecnológico que adoptaremos

El portal del jugador (`packages/liga-jugador`) será un **tercer paquete del monorepo** que consume la misma base de datos Supabase en modo mayoritariamente de lectura, salvo la acción de vincular batallas.

**Arquitectura general:**
```
Supercell API
    ↓
CRON/Sync ──→ Supabase PostgreSQL ──→ LIGA-ADMIN (admin)
                                  └──→ LIGA-JUGADOR (jugadores)  ← nuevo
```

## Stack Tecnológico

Mismo stack que `liga-admin` para maximizar reutilización de conocimiento y patrones:

| Capa | Tecnología |
|------|-----------|
| Framework | React 19 + hooks |
| Build | Vite 7 |
| Routing | React Router 7 |
| Estilos | Tailwind CSS 4 |
| DB/Auth | Supabase JS Client v2 |
| Real-time | Supabase subscriptions |
| Iconos | Lucide React (`Eye`, `Swords`, `Trophy`, etc.) |
| Linting | ESLint 9 |
| Testing | Vitest + Playwright (e2e) |
| PWA | vite-plugin-pwa (opcional fase 2) |

**Ruta del paquete:** `packages/liga-jugador/`

## Autenticación

### Google OAuth via Supabase Auth

**Flujo:**
1. Jugador abre la app → pantalla de Login
2. Presiona "Continuar con Google" → popup OAuth de Google
3. Supabase Auth valida el token y crea/recupera sesión
4. El sistema busca o crea el contexto de aplicación en `app_user` (`id = auth.users.id`, `email`, `role`)
5. El sistema verifica que exista un vínculo en `app_user_player` hacia un `player.player_id`
6. Si no existe vínculo o el rol no corresponde → pantalla de "Acceso Restringido" (no se entra)
7. Si existe vínculo → redirige al Dashboard

**Consideración de seguridad:** El acceso está doblemente controlado:
- Supabase Auth gestiona la identidad Google
- RLS (Row Level Security) en Supabase restringe los datos que cada jugador puede leer/escribir
- El admin registra el email del jugador en el sistema antes de que pueda acceder

### Mapeo Usuario ↔ Jugador

El esquema actual ya resuelve esta relación y no conviene duplicarla:
- `app_user.id` referencia `auth.users.id`
- `app_user.email` almacena el correo autenticado
- `app_user_player.user_id -> app_user.id`
- `app_user_player.player_id -> player.player_id`

**Decisión arquitectónica:** reutilizar `app_user` + `app_user_player` como fuente única de identidad del portal del jugador. No se añade `email` a `player` ni una tabla `player_auth` nueva.

## Estructura del Paquete

```
packages/liga-jugador/
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.cjs
├── postcss.config.cjs
├── eslint.config.js
├── public/
│   └── favicon.ico
└── src/
    ├── main.jsx                    # Entry point
    ├── App.jsx                     # Router principal
    ├── supabaseClient.js           # Instancia Supabase
    ├── pages/
    │   ├── LoginJugador.jsx        # Pantalla 1: Login Google
    │   ├── DashboardJugador.jsx    # Pantalla 2: Dashboard personal
    │   ├── TablaPosiciones.jsx     # Pantalla 3: Standings individuales
    │   ├── TablaEquipos.jsx        # Pantalla 4: Standings de equipos
    │   ├── BatallasPendientes.jsx  # Pantalla 5: Batallas pendientes
    │   └── HistorialBatallas.jsx   # Pantalla 7: Historial propio
    ├── components/
    │   ├── BottomNav.jsx           # Navbar inferior (Inicio/Batallas/Tabla/Perfil)
    │   ├── BattleDetailModal.jsx   # Pantalla 6 + icono ojo: Detalle de batalla
    │   ├── VincularBatallaPanel.jsx # Panel/sheet asociar batallas
    │   ├── BattleCard.jsx          # Tarjeta de batalla reutilizable con icono ojo
    │   ├── StandingsRow.jsx        # Fila de ranking individual
    │   ├── TeamStandingsRow.jsx    # Fila de equipo en standings
    │   ├── PendingBattleCard.jsx   # Tarjeta de batalla pendiente
    │   ├── StatsBadge.jsx          # Badge de estadística (victorias/%, etc.)
    │   └── ProtectedRoute.jsx      # Guard de ruta autenticada
    └── services/
        ├── authService.js          # Login/logout/session via Supabase Auth
        ├── dashboardService.js     # Stats del jugador, matches pendientes resumen
        ├── standingsService.js     # Queries de rankings individuales y de equipo
        ├── battlesService.js       # Historial, batallas no vinculadas, vincular
        └── scheduledMatchesService.js # Matches programados pendientes
```

## Rutas de la App

| Ruta | Componente | Descripción |
|------|-----------|-------------|
| `/` | Redirect → `/login` o `/dashboard` | Según estado de sesión |
| `/login` | `LoginJugador` | Login Google (pública) |
| `/dashboard` | `DashboardJugador` | Dashboard personal (protegida) |
| `/tabla` | `TablaPosiciones` | Standings individuales (protegida) |
| `/tabla/equipos` | `TablaEquipos` | Standings de equipos (protegida) |
| `/batallas` | `BatallasPendientes` | Batallas pendientes (protegida) |
| `/historial` | `HistorialBatallas` | Historial propio (protegida) |

## Modelo de Datos (Lectura)

El portal del jugador lee de las siguientes tablas existentes en Supabase:

### Datos del jugador autenticado
```sql
-- Identidad de aplicación
app_user: id, email, full_name, role
app_user_player: user_id, player_id, linked_at

-- Perfil competitivo
player: player_id, name, nick, is_internal, last_seen_at
player_identity: player_identity_id, player_id, player_tag, valid_from, valid_to
v_player_current_tag: player_id, player_tag, valid_from

-- Asignación en temporada activa
season_zone_team_player: season_zone_team_player_id, zone_id, team_id, player_id, jersey_no, is_captain, league, ranking_seed, start_date, end_date

-- Equipo y zona
team: team_id, name, logo
season_zone: zone_id, season_id, name, zone_order, last_snapshot_at

-- Temporada activa
season: season_id, description, status, duel_start_date, ladder_start_date, created_at
```

### Batallas y rondas
```sql
-- Batallas
battle: battle_id, battle_time, api_battle_type, api_game_mode, team_size, round_count, sync_status, raw_payload

-- Rondas por batalla
battle_round: battle_round_id, battle_id, round_no

-- Detalle de rondas por jugador (mazos, cartas)
battle_round_player: battle_round_player_id, battle_round_id, player_id, side, crowns, opponent_crowns, deck_cards, elixir_avg, opponent

-- Batallas programadas
scheduled_match: scheduled_match_id, season_id, zone_id, competition_id, competition_stage_id, competition_group_id, type, stage, best_of, expected_team_size, player_a_id, player_b_id, day_no, scheduled_from, scheduled_to, deadline_at, status, score_a, score_b
scheduled_match_battle_link: scheduled_match_battle_link_id, scheduled_match_id, battle_id, linked_by_player, linked_by_admin, linked_at
scheduled_match_result: scheduled_match_id, final_score_a, final_score_b, decided_by, decided_at, points_a, points_b
```

### Rankings y puntos
```sql
-- Home/summary read model
player_home_snapshot: season_id, zone_id, player_id, data, updated_at

-- Standings de lectura optimizada
player_standings_snapshot: season_id, zone_id, scope, league, player_id, position, points_total, wins, losses, ranking_seed, delta_position
team_standings_snapshot: season_id, zone_id, team_id, position, points_total, wins, losses, delta_position

-- Views auxiliares
v_active_team_players, v_player_points, v_player_wl, v_season_zone_player
```

## Componente BattleDetailModal (Icono Ojo)

### Requerimiento
Cada lista de batallas (historial, panel de vinculación) debe mostrar un icono de **ojo** (`<Eye />` de Lucide React) que al hacer click abre el detalle de la batalla.

### Implementación
El `BattleDetailModal` de `liga-admin` (`packages/liga-admin/src/components/BattleDetailModal.jsx`) será **replicado/adaptado** en `packages/liga-jugador/src/components/BattleDetailModal.jsx`.

En fase 2 se puede considerar extraerlo a `shared/ui/` como componente de librería compartida.

**Contenido del modal:**
- Resultado general (Victoria/Derrota, score de coronas)
- Lista de rondas con resultado individual
- Mazos usados por cada jugador en cada ronda (imágenes de cartas)
- Tipo de batalla (Duelo de Guerra, Copa de Liga, Copa Revenge, etc.)
- Fecha y hora de la batalla

## Panel de Vinculación de Batallas (VincularBatallaPanel)

Cuando el jugador hace click en el botón **"Vincular"** en una batalla pendiente:
1. Se abre un sheet/panel desde abajo
2. Header: "Vinculando a: [nombre del rival]" + botón cerrar
3. Lista scrollable de las últimas N batallas **no vinculadas** del jugador vs ese rival
4. Cada entrada: resultado (Victoria/Derrota), score de coronas, tiempo relativo, **checkbox de selección**, **icono ojo** para ver detalle
5. Footer: contador "Seleccionadas: X de Y" + botón "Vincular Batallas" (activo cuando hay ≥1 seleccionada)
6. Al confirmar: inserta filas en `scheduled_match_battle_link`, registra `linked_by_player = app_user.id`, y actualiza `scheduled_match.status` → `LINKED`

**Regla importante por tipo de match:**
- Si `scheduled_match.player_b_id` existe, el panel filtra batallas no vinculadas entre ambos jugadores internos.
- Si `scheduled_match.player_b_id` es `NULL` (caso común en `CW_DAILY`), el panel no depende de un rival interno y filtra batallas 1v1 recientes del jugador dentro de la ventana `scheduled_from` → `deadline_at`.

## Navegación Mobile (Bottom Nav)

Barra inferior fija con 4 ítems según el diseño Stitch:

| Ícono | Label | Ruta |
|-------|-------|------|
| `Home` | Inicio | `/dashboard` |
| `Swords` | Batallas | `/batallas` |
| `Trophy` | Tabla | `/tabla` |
| `User` | Perfil/Clan | `/tabla/equipos` o perfil futuro |

## Configuración de Entorno

```env
# packages/liga-jugador/.env (no commitear)
VITE_SUPABASE_URL=https://kivlwozjpijejrubapcw.supabase.co
VITE_SUPABASE_ANON_KEY=<anon_key>
VITE_GOOGLE_CLIENT_ID=<gcp_oauth_client_id>   # Solo si se configura directamente
```

El Client ID de Google debe configurarse en Supabase Dashboard → Auth → Providers → Google.

## Decisiones de Diseño

### Decisión 1: Paquete separado vs. rutas en liga-admin
**Elección:** Paquete separado `packages/liga-jugador`  
**Razón:** Liga-admin es una herramienta de administradores; mezclar roles en la misma app genera complejidad de auth, seguridad y UX. Paquetes separados permiten despliegues independientes y URLs distintas.

### Decisión 2: Mismo stack que liga-admin
**Elección:** React + Vite + Tailwind + Supabase  
**Razón:** Maximiza reúso de patrones, evita curva de aprendizaje adicional, facilita compartir componentes en el futuro.

### Decisión 3: BattleDetailModal duplicado en esta fase
**Elección:** Copiar/adaptar el modal de liga-admin (no compartir via package)  
**Razón:** Coste de configurar un shared package (build system, exports, versioning) supera el beneficio en esta fase inicial. El refactor hacia `shared/ui` se hace cuando haya un tercer consumidor.

### Decisión 4: Solo lectura de DB + escritura limitada
**Elección:** El portal del jugador solo puede crear vínculos en `scheduled_match_battle_link` y mover matches a `LINKED`; no calcula ni persiste resultados finales  
**Razón:** Mantiene integridad. El resultado consolidado sigue bajo `scheduled_match_result` y procesos admin/auto.

### Decisión 5: Leer snapshots y views, no recalcular standings en frontend
**Elección:** Dashboard y rankings leerán `player_home_snapshot`, `player_standings_snapshot`, `team_standings_snapshot` y views auxiliares cuando aplique.  
**Razón:** Evita duplicar lógica de scoring y reduce riesgo de divergencia con `liga-admin`.
