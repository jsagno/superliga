# Tareas: Liga Jugador — Portal del Jugador

## 1. Scaffold del Paquete

- [x] 1.1 Crear `packages/liga-jugador/` con `npm create vite` (React + JS, o clonar estructura de liga-admin)
- [x] 1.2 Instalar dependencias: `react`, `react-dom`, `react-router-dom`, `@supabase/supabase-js`, `lucide-react`
- [x] 1.3 Configurar Tailwind CSS 4 (`tailwind.config.cjs`, `postcss.config.cjs`)
- [x] 1.4 Configurar ESLint 9
- [x] 1.5 Configurar Vite (alias `@/` → `src/`, env variables VITE_SUPABASE_*)
- [x] 1.6 Crear `src/supabaseClient.js` con inicialización del cliente Supabase
- [x] 1.7 Crear `packages/liga-jugador/.env.example` con variables requeridas
- [x] 1.8 Añadir `packages/liga-jugador/` al `.gitignore` para `.env` local
- [x] 1.9 Actualizar `package.json` raíz del monorepo con script `liga-jugador:dev`
- [x] 1.10 Verificar que el servidor Vite arranca sin errores en puerto 5174 (o siguiente disponible)

## 2. Autenticación Google OAuth

- [x] 2.1 Habilitar proveedor Google en Supabase Dashboard → Auth → Providers
- [x] 2.2 Crear `src/services/authService.js` con funciones: `signInWithGoogle()`, `signOut()`, `getSession()`, `onAuthStateChange()`
- [x] 2.3 Implementar `src/pages/LoginJugador.jsx` siguiendo diseño Stitch `5d974919f0ef4fd0ba1facda157fd09a`
  - Header: icono `sports_esports`, título "Bienvenido a la Arena", subtítulo "Liga Interna de Clash Royale"
  - Botón "Continuar con Google" con ícono Google
  - Aviso de acceso restringido (email debe estar pre-autorizado)
  - Footer: versión + "Powered by Internal League System"
- [x] 2.4 Implementar `src/components/ProtectedRoute.jsx` — redirige a `/login` si no hay sesión
- [x] 2.5 Implementar lógica de verificación post-login: resolver `auth.users.id -> app_user -> app_user_player -> player`
  - Si no existe `app_user_player` o el rol no es válido → mostrar error "Acceso no autorizado" y hacer `signOut()`
  - Si existe → guardar `app_user.id` y `player_id` en contexto y redirigir a `/dashboard`
- [x] 2.6 Implementar `src/App.jsx` con React Router 7 y rutas protegidas
- [ ] 2.7 Definir proceso de bootstrap de identidad: alta de `app_user` + vínculo en `app_user_player` para jugadores autorizados
- [ ] 2.8 Test manual: login con email autorizado → accede; login con email no registrado → rechaza

## 3. Bottom Navigation

- [x] 3.1 Implementar `src/components/BottomNav.jsx` con 4 ítems (Inicio, Batallas, Tabla, Perfil/Clan)
- [x] 3.2 Aplicar estilo activo al ítem de la ruta actual (`useLocation()`)
- [x] 3.3 Usar iconos Lucide: `Home`, `Sword`, `Trophy`, `Users`
- [x] 3.4 Fijar barra al bottom con `fixed bottom-0` y soporte para safe-area en iOS (`pb-safe`)
- [x] 3.5 Verificar que el contenido de cada página no quede oculto detrás del nav (padding-bottom)

## 4. Pantalla 2: Dashboard del Jugador

**Referencia Stitch:** `f7a60da1d5fc444b9bf13d7238c02280`  
**Archivo:** `src/pages/DashboardJugador.jsx`

- [x] 4.1 Crear `src/services/dashboardService.js`:
  - `fetchPlayerProfile(playerId)` → nombre/nick, zona, liga, equipo, temporada activa
  - `fetchPlayerStats(playerId, seasonId, zoneId)` → `player_standings_snapshot` (wins, losses, winRate, position)
  - `fetchPendingMatchesSummary(playerId)` → primeras 3 filas `scheduled_match` estado `PENDING`
- [x] 4.2 Implementar header: "Bienvenido, [nombre]" + campana de notificaciones + label "Liga Interna"
- [x] 4.3 Implementar sección "Zona X · Liga A/B" con progreso de temporada (barra + "X/20 · días restantes")
- [x] 4.4 Implementar stats badges: Victorias (🏆), Derrotas (✖), Win Rate (⭐), Ranking (#N)
- [x] 4.5 Implementar sección "⚔ Batallas Pendientes" con preview (máx 3 cards) y link a `/batallas`
- [x] 4.6 Cada card de batalla pendiente muestra: oponente, tipo, countdown (countdown urgente en rojo)
- [x] 4.7 Liga A/B visible en "Zona X · Liga A/B" — badge diferenciado por texto
- [x] 4.8 Estado de carga skeleton mientras se obtienen los datos (RF-DASH-06), error state con retry
- [x] 4.9 Test: dashboard cubierto con E2E bypass controlado (`localStorage` + `VITE_E2E_AUTH_BYPASS`) para escenarios autenticados y no autenticados en `tests/e2e/dashboard.spec.js`

## 5. Pantalla 3: Tablas de Posiciones (Zonas / Liga A / Liga B)

**Referencia Stitch:** `bde972608291443190fe80ccffc82c8c`  
**Archivo:** `src/pages/TablaPosiciones.jsx`

- [x] 5.1 Crear `src/services/standingsService.js`:
  - `fetchSeasons()` → lista de temporadas disponibles
  - `fetchPlayerStandings(seasonId, zoneId?, scope, league?)` → ranking desde `player_standings_snapshot` enriquecido con `player`, `team`, `v_player_current_tag`
- [x] 5.2 Implementar selector de temporada (dropdown "Temporada X")
- [x] 5.3 Implementar tabs: "Zonas" | "Liga A" | "Liga B"
- [x] 5.4 Implementar filtro de zona: chips "Todas" | "Zona 1" | "Zona 2" | "Zona 3" | "Zona 4"
- [x] 5.5 Implementar lista ordenada de jugadores con:
  - Posición (#N), avatar, nombre, puntos
  - Indicador de tendencia: `arrow_drop_up` (subió) / `remove` (estable) / `arrow_drop_down` (bajó)
  - W-L record y nombre del clan
- [x] 5.6 Resaltar la fila del jugador autenticado (etiqueta "(Tú)", fondo diferenciado)
- [x] 5.7 Auto-scroll a la fila del jugador autenticado al cargar
- [x] 5.8 Implementar `src/components/StandingsRow.jsx` para cada fila de jugador
- [x] 5.9 Test: tabla carga, filtros funcionan, jugador propio está resaltado

## 6. Pantalla 4: Tabla de Posiciones de Equipos

**Referencia Stitch:** `d4189a3869e9487cb64c11327c7d7f48`  
**Archivo:** `src/pages/TablaEquipos.jsx`

- [x] 6.1 Añadir a `standingsService.js`: `fetchTeamStandings(seasonId, zoneId)` → ranking desde `team_standings_snapshot` enriquecido con `team`
- [x] 6.2 Implementar selector de zona (tabs "Zona 1" | "Zona 2" | etc.)
- [x] 6.3 Implementar podio de los 3 primeros equipos (posiciones 2-1-3 estilo olímpico)
  - #1 centro (más alto), #2 izquierda, #3 derecha
  - Nombre del equipo, puntos, icono de corona para el primero
- [x] 6.4 Implementar tabla general con columnas: # | Equipo | Pts (y W-L record debajo)
- [x] 6.5 Indicadores de tendencia por equipo
- [x] 6.6 Resaltar el equipo del jugador autenticado
- [x] 6.7 Implementar `src/components/TeamStandingsRow.jsx`
- [x] 6.8 Test: podio y tabla cargan por zona correctamente

## 7. Pantalla 5: Batallas Pendientes

**Referencia Stitch:** `a6eec8e65e024088875d3c8685765e60`  
**Archivo:** `src/pages/BatallasPendientes.jsx`

- [x] 7.1 Crear `src/services/scheduledMatchesService.js`:
  - `fetchPendingMatches(playerId, seasonId)` → `scheduled_match` con estado `PENDING`, joins a `competition`, `player_a`, `player_b`
- [x] 7.2 Implementar header "Batallas Pendientes" con campana de notificaciones e ícono de vista (grid/list)
- [x] 7.3 Implementar tabs de filtro: "Todas" | "Copa de Liga" (🏆) | "Duelo Diario" (⚔)
- [x] 7.4 Implementar `src/components/PendingBattleCard.jsx`:
  - Nombre del rival, tipo de batalla
  - Countdown hasta el límite: "Límite dentro de X días, Y horas, Z minutos" (color rojo si urgente)
  - Botón "Reportar" (✏ / editar) — para fase posterior
  - Botón "Vincular" (🔗) — abre `VincularBatallaPanel`
- [x] 7.5 Estado vacío cuando no hay batallas pendientes
- [x] 7.6 Badge de count en el ícono de Batallas del BottomNav cuando hay pendientes
- [x] 7.7 Test: lista se carga, filtros por tipo funcionan, countdown se actualiza en tiempo real

## 8. Pantalla 6: Asociar Batallas (Panel Vincular)

**Referencia Stitch:** `133ac58ba0a3448ea275c9387fd41cb2`  
**Archivo:** `src/components/VincularBatallaPanel.jsx`

- [x] 8.1 Implementar `src/services/battlesService.js`:
  - `fetchUnlinkedBattles(matchContext, limit)` → últimas N batallas no vinculadas compatibles con ese `scheduled_match`
  - `linkBattlesToScheduledMatch(scheduledMatchId, battleIds[], appUserId)` → inserta en `scheduled_match_battle_link` y actualiza estado a `LINKED`
- [x] 8.2 Implementar panel/sheet deslizable desde abajo (bottom sheet):
  - Header: "Vinculando a: [nombre del rival]" + botón ✕ cerrar
  - Subtítulo: "Mostrando últimas N batallas no vinculadas"
- [x] 8.3 Cada entrada de batalla en el panel muestra:
  - Checkbox de selección
  - Resultado (Victoria ✓ / Derrota ✗) con color (verde/rojo)
  - Score de coronas (ej. "3 - 1")
  - Tiempo relativo ("Hace 23 min", "Hace 1 hora")
  - **Icono Ojo** (👁 `<Eye />`) que abre `BattleDetailModal` con el detalle de esa batalla
- [x] 8.4 Footer pegajoso: "Seleccionadas: X de Y" + botón "Vincular Batallas" (deshabilitado si 0 seleccionadas)
- [x] 8.5 Al confirmar: llamar a `linkBattlesToScheduledMatch()`, cerrar panel, actualizar la lista de pendientes
- [x] 8.6 Feedback de éxito ("✓ Batalla vinculada") y manejo de error
- [x] 8.7 Test: abrir panel, seleccionar batallas, vincular, verificar que desaparece del pendiente

## 9. Pantalla 7: Histórico de Batallas Propias

**Referencia Stitch:** `dfd831b5ce054c28957e9ce253aced7d`  
**Archivo:** `src/pages/HistorialBatallas.jsx`

- [x] 9.1 Añadir a `battlesService.js`:
  - `fetchPlayerBattleHistory(playerId, filters)` → historial paginado con filtros
  - `fetchPlayerGlobalStats(playerId, seasonId)` → totales: victorias, ratio, etc.
- [x] 9.2 Implementar header "Histórico" con botón back (← vuelve al dashboard)
- [x] 9.3 Implementar selector de temporada (dropdown expandible)
- [x] 9.4 Implementar tabs de tipo de batalla: "Todos" | "Duelo de Guerra" | "Copa de Liga" | "Copa Revenge"
- [x] 9.5 Implementar badges de estadísticas globales: "Total: N victorias", "N batallas", "Win Rate X%"
- [x] 9.6 Implementar sección "Batallas Recientes" con lista de `BattleCard`:
  - Ícono de tipo (⚔ duelo / 🏆 copa)
  - "vs. [nombre del rival]"
  - Score (ej. "2 - 0"), tipo, tiempo relativo
  - **Icono Ojo** (👁 `<Eye />`) que abre `BattleDetailModal`
  - Flecha chevron derecha (expansión opcional en fase 2)
- [x] 9.7 Implementar carga progresiva: "Cargando más batallas…" spinner al hacer scroll al final
- [x] 9.8 Implementar `src/components/BattleCard.jsx` reutilizable
- [x] 9.9 Test: historial carga, filtros funcionan, icono ojo abre el detalle correcto

## 10. Componente BattleDetailModal (Icono Ojo)

**Archivo:** `src/components/BattleDetailModal.jsx`

- [x] 10.1 Adaptar `BattleDetailModal.jsx` de `liga-admin` para uso en `liga-jugador`
  - Copiar lógica de fetching de `battle_round` y `battle_round_player`
  - Adaptar estilos a la paleta oscura del portal del jugador
- [x] 10.2 Asegurar que el modal muestra:
  - Título: tipo de batalla + fecha
  - Resultado: Victoria/Derrota, score total de coronas
  - Lista de rondas con: round número, resultado, coronas, mazos (imágenes de cartas si disponibles)
  - Nombre e identificador del rival
- [x] 10.3 Cerrar modal con ✕ o click fuera del área
- [x] 10.4 Accesibilidad: trap focus dentro del modal cuando está abierto, `aria-modal="true"`
- [x] 10.5 Test: abre desde historial, muestra datos correctos de la batalla seleccionada
- [x] 10.6 Test: abre desde panel de vinculación, muestra datos correctos

## 11. Row Level Security (RLS) en Supabase

- [x] 11.1 Definir política RLS en `app_user` y `app_user_player`: el usuario autenticado solo puede leer su propio vínculo
- [x] 11.2 Definir política RLS en `scheduled_match`: el jugador puede leer matches donde participa (`player_a_id`/`player_b_id`) y actualizar solo transiciones permitidas hacia `LINKED`
- [x] 11.3 Definir política RLS en `battle`, `battle_round` y `battle_round_player`: acceso de lectura cuando el jugador participa o es el owner lógico del vínculo
- [x] 11.4 Definir política RLS en `player`: el usuario puede leer su propio registro a través de `app_user_player`
- [x] 11.5 Verificar que desde el portal **no es posible** leer datos de otros jugadores no relacionados
- [x] 11.6 Documentar las políticas RLS en `shared/database/README.md`

## 12. Integración y Pruebas Finales

- [x] 12.1 Flujo completo: login → dashboard → ver standings → ver batallas pendientes → vincular batalla
- [x] 12.2 Flujo completo: login → historial → click ojo en batalla → ver detalle de rondas y mazos
- [x] 12.3 Test con email no autorizado → recibe mensaje de acceso restringido, no puede entrar
- [x] 12.4 Test con sesión expirada → redirige automáticamente a login
- [x] 12.5 Verificar responsividad mobile (375px, 390px, 414px de ancho)
- [x] 12.6 Verificar que el bottom nav no oculta contenido interactivo en ninguna pantalla
- [x] 12.7 Verificar que dados los permisos RLS un jugador NO puede ver datos de otro jugador
- [x] 12.8 Test de rendimiento: primer load completo del dashboard < 3 segundos en red 4G simulada

## 13. Configuración de Despliegue

- [x] 13.1 Configurar `vite.config.js` con `base: '/'` y `build.outDir: 'dist'`
- [x] 13.2 Añadir `packages/liga-jugador/DEPLOYMENT_CHECKLIST.md`
- [x] 13.3 Actualizar `README.md` raíz con instrucciones para levantar `liga-jugador`
- [x] 13.4 Verificar que variables de entorno para producción están documentadas

## 14. Documentación

- [x] 14.1 Crear `packages/liga-jugador/README.md` con descripción, setup, y comandos
- [x] 14.2 Actualizar `docs/openspec/products/liga-jugador.md` con la especificación completa del producto
- [x] 14.3 Actualizar `docs/openspec/changelog.md` con el cambio `liga-jugador`
- [x] 14.4 Añadir entrada en `docs/openspec/README.md` referenciando el nuevo producto

