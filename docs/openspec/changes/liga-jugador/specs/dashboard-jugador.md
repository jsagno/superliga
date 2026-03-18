# Feature: Dashboard del Jugador

**Producto:** liga-jugador  
**Stitch Screen ID:** `f7a60da1d5fc444b9bf13d7238c02280`  
**Archivo objetivo:** `packages/liga-jugador/src/pages/DashboardJugador.jsx`  
**Estado:** 🔴 Por implementar

---

## Descripción

Pantalla de inicio personalizada que muestra un resumen del estado del jugador en la temporada activa: su zona y liga, el progreso de la temporada, sus estadísticas claves (victorias, derrotas, win rate, ranking), y un preview de sus batallas pendientes más próximas.

---

## Diseño Visual

![Dashboard](https://lh3.googleusercontent.com/aida/AOfcidU5MhLkgdGlRNB5yXbrHs13KfYzuZXamIaGprSBj7nLJbZOeGIONu3BtHemKydbuErCm_XYgyjOoI0FpIcj1nY8OvlK_nFGs6QyvIaso_VBzJPyW-6UnGv6JY8VJ2dsW7sU4MarJK9LDwLAmYuaGLNlGjTr3lY_UPwVxSlB7-Mm9h3ifnEuvZRlh_oXoIppXj9bnG9zyilBaYUHqCfr0KhlUcqS3pusQWRa3vn3vEmTCKpmuLTtCEvzjgA)

---

## Requerimientos Funcionales

### RF-DASH-01: Mensaje de bienvenida personalizado
- Mostrar: "Bienvenido, [nombre del jugador]"
- Icono de notificaciones (campana) en el header — no funcional en v0.1, visible como elemento de diseño
- Label "Liga Interna" como subtítulo del header

### RF-DASH-02: Contexto de zona y liga
- Mostrar el nombre de la zona y la liga del jugador en la temporada activa
- Formato: "Zona X · Liga A" o "Zona X · Liga B"
- Obtener de `season_zone_team_player` + `zone` para la temporada activa

### RF-DASH-03: Progreso de temporada
- Texto: "Progreso Temporada N"
- Fracción de batallas jugadas vs total: "X/20"
- Días restantes: "Y días de duelo para finalizar la temporada"
- Barra visual de progreso (% completado)

### RF-DASH-04: Estadísticas del jugador
Grid 2×2 con 4 métricas:
- 🏆 **Victorias**: total de victorias en la temporada activa
- ✖ **Derrotas**: total de derrotas en la temporada activa
- ⭐ **Win Rate**: porcentaje de victorias (redondeado, ej. "68%")
- 🏅 **Ranking**: posición en la clasificación de su zona (ej. "#4 Ranking (1-16)")

### RF-DASH-05: Batallas pendientes - preview
- Sección "⚔ Batallas Pendientes"
- Mostrar máximo 2-3 batallas pendientes próximas
- Por cada batalla: nombre del rival, tipo ("Duelo Diario", "Copa de Liga"), mensaje de tiempo ("Sin horario fijado" o countdown)
- Botón "Jugar" o link que navega a `/batallas` para ver todas
- Si no hay batallas pendientes: mostrar "No tienes batallas pendientes 🎉"

### RF-DASH-06: Estado de carga
- Mostrar skeletons o spinners mientras se cargan los datos
- Mostrar error descriptivo si alguna query falla

---

## Queries de Datos

```javascript
// dashboardService.js

// Perfil y contexto de zona
SELECT p.player_id, p.name, p.nick, z.zone_id, z.name as zone_name, s.season_id, s.description as season_name, sztp.team_id, sztp.league
FROM player p
JOIN season_zone_team_player sztp ON sztp.player_id = p.player_id
JOIN season_zone z ON z.zone_id = sztp.zone_id
JOIN season s ON s.season_id = z.season_id
WHERE p.player_id = :playerId AND s.status = 'ACTIVE'

// Stats de la temporada
-- Leer `player_standings_snapshot` (position, points_total, wins, losses)
-- Complementar con `player_home_snapshot.data` para métricas compactas de home si el snapshot existe

// Matches pendientes (primeras 2-3)
SELECT sb.*, p.name as rival_name
FROM scheduled_match sm
LEFT JOIN player p ON p.player_id = CASE WHEN sm.player_a_id = :playerId THEN sm.player_b_id ELSE sm.player_a_id END
WHERE (sm.player_a_id = :playerId OR sm.player_b_id = :playerId)
  AND sm.status = 'PENDING'
ORDER BY sm.deadline_at ASC NULLS LAST, sm.scheduled_from ASC NULLS LAST
LIMIT 3
```

---

## Componentes UI

```
DashboardJugador
├── Header
│   ├── "Bienvenido, [nombre]"
│   ├── [BellIcon] notificaciones
│   └── "Liga Interna"
├── SeasonContext
│   ├── "Zona X · Liga A"
│   └── ProgressBar + "Temporada N · X/20 · Y días"
├── StatsGrid (2×2)
│   ├── StatsBadge(victorias, trofeo)
│   ├── StatsBadge(derrotas, x)
│   ├── StatsBadge(winRate, estrella)
│   └── StatsBadge(ranking, leaderboard)
├── PendingBattlesPreview
│   ├── SectionHeader "⚔ Batallas Pendientes"
│   ├── PendingBattleCard × N
│   └── [Link → /batallas "Ver todas"]
└── BottomNav
```

---

## Casos de Prueba

| # | Escenario | Resultado Esperado |
|---|-----------|-------------------|
| 1 | Jugador con temporada activa y batallas pendientes | Muestra zona, stats, y preview de batallas |
| 2 | Jugador sin batallas pendientes | Muestra "No tienes batallas pendientes 🎉" |
| 3 | Jugador sin asignación en temporada activa | Muestra mensaje informativo |
| 4 | Error de red al cargar dashboard | Muestra error con opción de recargar |
| 5 | Win Rate = 0% (0 victorias) | Muestra "0%" sin errores de división |
