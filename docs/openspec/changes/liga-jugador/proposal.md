# Propuesta: Liga Jugador — Portal del Jugador

## Por qué

Actualmente, los jugadores de Liga Interna no tienen ninguna interfaz propia. Para saber su posición en el ranking, cuántas batallas tienen pendientes o sus estadísticas personales, deben preguntar a un administrador o esperar a que se publique información en WhatsApp/Discord.

Esto genera:
- **Fricción innecesaria**: los jugadores no saben en tiempo real cuál es su situación competitiva
- **Carga sobre los admins**: preguntas repetitivas que podrían resolverse con acceso directo
- **Falta de engagement**: sin visibilidad, los jugadores se desconectan de la competencia
- **Errores en la vinculación de batallas**: los jugadores no pueden auto-reportar ni vincular sus propias batallas, generando inconsistencias que el admin debe resolver manualmente

La plataforma ya tiene toda la data en Supabase. Lo que falta es una interfaz para que el jugador acceda a ella.

## Qué Cambia

Creación de un nuevo paquete `packages/liga-jugador` — una Progressive Web App (PWA) mobile-first dirigida exclusivamente a los jugadores participantes del torneo.

### Pantallas del Portal

| # | Pantalla | ID Stitch | Descripción |
|---|----------|-----------|-------------|
| 1 | Login de Jugador (Google) | `5d974919f0ef4fd0ba1facda157fd09a` | Autenticación via Google OAuth con control de acceso por email pre-autorizado |
| 2 | Dashboard del Jugador | `f7a60da1d5fc444b9bf13d7238c02280` | Vista personal: zona/liga, progreso de temporada, stats clave, batallas pendientes resumidas |
| 3 | Tablas de Posiciones (Zonas / Liga A / Liga B) | `bde972608291443190fe80ccffc82c8c` | Rankings individuales por zona con filtros de temporada, tabs Liga A/B, y el jugador propio resaltado |
| 4 | Tabla de Posiciones de Equipos | `d4189a3869e9487cb64c11327c7d7f48` | Clasificación de equipos con podio de los 3 primeros por zona y tabla general |
| 5 | Batallas Pendientes | `a6eec8e65e024088875d3c8685765e60` | Lista de enfrentamientos pendientes con countdown, filtros por tipo, y acciones de Reportar y Vincular |
| 6 | Asociar Batallas (modal "Vincular") | `133ac58ba0a3448ea275c9387fd41cb2` | Panel lateral/modal para seleccionar batallas no vinculadas del historial propio y asociarlas al enfrentamiento pendiente |
| 7 | Histórico de Batallas Propias | `dfd831b5ce054c28957e9ce253aced7d` | Historial completo de batallas jugadas, con filtros por temporada y tipo, estadísticas globales, y visualizador de detalle de batalla |

### Requirement Transversal: Visualizador de Batalla (Icono Ojo)

En toda pantalla donde aparezca una batalla (Histórico y modal Asociar Batallas), debe existir un **icono de ojo (👁)** que abra un detalle de la batalla idéntico al `BattleDetailModal` del proyecto `liga-admin`. Esto permite al jugador ver rondas, mazos, resultado por corona, y el modo de juego, sin salir de la app.

## Capacidades

### Capacidades Nuevas
- `google-oauth-player-login`: Autenticación OAuth Google con validación de email autorizado
- `player-dashboard`: Vista de estadísticas y estado de temporada del jugador autenticado
- `player-zone-standings`: Tablas de posición con tabs por liga (A/B) y filtro por zona, jugador propio resaltado
- `team-standings`: Clasificación de equipos por zona con podio y tendencias
- `pending-battles-view`: Vista de batallas programadas pendientes del jugador con countdown por límite de tiempo
- `battle-linking-panel`: Selección de batallas recientes del historial para vincular a un enfrentamiento pendiente
- `own-battle-history`: Historial personal de batallas con filtros multidimensionales y stats globales
- `battle-detail-viewer`: Visualizador de detalle de batalla (rondas, mazos, coronas) accesible desde icono ojo en cualquier lista

### Capacidades Modificadas
- `liga-admin/BattleDetailModal`: Deberá refactorizarse o extraerse como componente compartido en `shared/ui` para reutilización en liga-jugador

## Impacto

- **Nuevo paquete**: `packages/liga-jugador/` (React 19 + Vite 7 + Tailwind 4 + Supabase JS)
- **Base de datos**: Lectura de tablas y vistas existentes (`app_user`, `app_user_player`, `player`, `player_identity`, `v_player_current_tag`, `season`, `season_zone`, `season_zone_team_player`, `player_home_snapshot`, `player_standings_snapshot`, `team_standings_snapshot`, `scheduled_match`, `scheduled_match_battle_link`, `battle`, `battle_round`, `battle_round_player`, `competition`)
- **Escritura**: Solo para la acción de vincular batallas (`scheduled_match_battle_link`) y actualizar el estado del match a `LINKED` cuando corresponda
- **Auth**: Supabase Auth con proveedor Google + mapeo existente `auth.users -> app_user -> app_user_player -> player`
- **Breaking Changes**: Ninguno — no modifica liga-admin ni el cron
- **Referencia de diseño**: Stitch Project `4206610767598271327`, screenshots en `Screens/LigaInterna/jugador/`

## Diseños de Referencia (Stitch)

Los diseños visuales están disponibles en Stitch Project ID `4206610767598271327`:

| Pantalla | Screenshot |
|----------|-----------|
| Login | ![Login](https://lh3.googleusercontent.com/aida/AOfcidXCFzn16TZh-trWRQa6yzb1YBz1iDbkzS2tsuoc79yj-bJjV2r4jQkuSkOMwNSD-4-DoaaRMiqNYL4ZIl3MeLlX4aYOVGtsQsBovjf1SkxmjnlSl3VPExzMSiKXDJhBlOcAvskqpGPDv3N0TDh_tqcUKdoGI2VXKwkwL8phRHmLF3Cg4HeOoriS3f4NdBz0cYGW3TZ6RGaR7itNRSoU0SxpESaNpqR9vx0z7UExOBnKzZGO5NKOiPq2RBw) |
| Dashboard | ![Dashboard](https://lh3.googleusercontent.com/aida/AOfcidU5MhLkgdGlRNB5yXbrHs13KfYzuZXamIaGprSBj7nLJbZOeGIONu3BtHemKydbuErCm_XYgyjOoI0FpIcj1nY8OvlK_nFGs6QyvIaso_VBzJPyW-6UnGv6JY8VJ2dsW7sU4MarJK9LDwLAmYuaGLNlGjTr3lY_UPwVxSlB7-Mm9h3ifnEuvZRlh_oXoIppXj9bnG9zyilBaYUHqCfr0KhlUcqS3pusQWRa3vn3vEmTCKpmuLTtCEvzjgA) |
| Tablas de Posiciones | ![Standings](https://lh3.googleusercontent.com/aida/AOfcidW8xsW4L7idXQ9w30ZwQVit6JoSut30oPEj34h0H5RmPrPOvoNiLK_j4VenczqIcvFTmk3qV3pxirpk9S4crEL4Nl6rUF0Ev0VJS289iqqZ_M7a7KVHKD7i_LRT4VrY8P1rUI4p9GYi0MzeBYgwe0AnhR-dD-zc6ZpBYyBXuCqAwp8Z7hrWRtCm7EzxU6be8NwWrGh_fFlaeUShTsnJloYu3HT-ffFj1sBLpuBruglNbc-_F9OqAqHARrQ) |
| Posiciones Equipos | ![Teams](https://lh3.googleusercontent.com/aida/AOfcidVuCPcCpR8RHByMx3leJ0gLOPHK1kNMwMnulM0xtunChufm7f61aAV4YSBdkfUerrcIx5eMHG3TPCMxwdt7qyBkcux_06eGi4F3CWdqiy74bzRBPmT0csr41hUhu0-D_gCiXYrQG5dzVSy6C4Zc1_mY6FQFqm11PC4AY-OmExgRtW7-KwRK4yfyEoVgPj8UGZviF9H8tbdLeyGIJlR_CnKttl-OPgsQYM0czV4APulmSQTE7pNQOaHjMg) |
| Batallas Pendientes | ![Pending](https://lh3.googleusercontent.com/aida/AOfcidXuxH9DT1xaSORUkvy3rJ4fI-Z7cmBXP8y5DDrTwvl2tEx2mq70cSMPZ35fLEjgZ35XqoKwOld9TzAe0ncgZ4SH13wvyZnBLdVOKyy_0ekWBGnX8dYBDceuFuT_sHSwGxEtpcOoHjo7VaMw7ioqCRD7xIFpALvhOMmYh1Ltb86g3h5Jnm0EaLuRCDR4QxgldrX4jlkvHcAC3Lp_9P2q-QcVIt1OEy9DJa-XbvEI55mpJvQhQXO9IE1yz8I) |
| Asociar Batallas | ![Link](https://lh3.googleusercontent.com/aida/AOfcidX74GLmVIKa2LdoYD6cMRcUS9UeUk4Zo_IjaSiNTVydWt4UeTeWHsKjT6eaLaXWfv_hL0gfQopOswE3JOwjyBqXUPuPJoBkKtl3TrlwLuPGEoAUEc4hzpfHAD5Tg5N0eMT5fO0S_4x-SZ02SLhxqpbEZKleuXrBp2kClSHRFvfLu_sCbBAYv40xzY4S66PlVcDExualdMB7fB9ASbj8qnQFStVe7maxWhE79_8Zdgi4VZKI7MlU2fT9suw) |
| Histórico | ![History](https://lh3.googleusercontent.com/aida/AOfcidVX-OVmOTKghFJU-GafPsqkFbFPQwdbAp1_DFXxsKDD-LUskzVMl_8XA3LYbyunoOd4znx6XhAApVsV0sTcMctXwDhV-2UvXZmGfHKT2Bd7lWqbsWWm_isRZOzLERUGZEPlOlwJOnQrmb7zQI1l8PsgTGQOBoiIGeSRMN0ve4hqXKccOYCA-pXpr9gFo3S0lGrzbxswggNC8yxGS7bCRd_RmUhE4To64EAmF3vTZ-fAGPXG78lVZGG2Crk) |

## Métricas de Éxito

- Los jugadores pueden ver su posición actual sin solicitar asistencia a un admin
- Tasa de vinculación de batallas realizada por el propio jugador ≥ 60% del total
- Reducción de preguntas de "¿cuál es mi puesto?" en canales de comunicación del clan
- Tiempo medio desde que se juega una batalla hasta que aparece vinculada en el sistema < 30 min
