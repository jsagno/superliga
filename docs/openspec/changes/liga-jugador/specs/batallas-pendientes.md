# Feature: Batallas Pendientes

**Producto:** liga-jugador  
**Stitch Screen ID:** `a6eec8e65e024088875d3c8685765e60`  
**Archivo objetivo:** `packages/liga-jugador/src/pages/BatallasPendientes.jsx`  
**Estado:** 🔴 Por implementar

---

## Descripción

Lista de todos los enfrentamientos programados pendientes del jugador autenticado. Permite filtrar por tipo de batalla y actuar sobre cada una: reportar incidencia o vincular batallas jugadas.

---

## Diseño Visual

![Batallas Pendientes](https://lh3.googleusercontent.com/aida/AOfcidXuxH9DT1xaSORUkvy3rJ4fI-Z7cmBXP8y5DDrTwvl2tEx2mq70cSMPZ35fLEjgZ35XqoKwOld9TzAe0ncgZ4SH13wvyZnBLdVOKyy_0ekWBGnX8dYBDceuFuT_sHSwGxEtpcOoHjo7VaMw7ioqCRD7xIFpALvhOMmYh1Ltb86g3h5Jnm0EaLuRCDR4QxgldrX4jlkvHcAC3Lp_9P2q-QcVIt1OEy9DJa-XbvEI55mpJvQhQXO9IE1yz8I)

---

## Requerimientos Funcionales

### RF-PENDIENTES-01: Lista de batallas pendientes
- Cargar todas las `scheduled_match` donde el jugador autenticado es `player_a_id` o `player_b_id` y el estado es `PENDING`
- Ordenar por `deadline_at ASC NULLS LAST`, luego `scheduled_from ASC NULLS LAST`
- Cuando hay muchas batallas, toda la lista es scrollable

### RF-PENDIENTES-02: Tabs de filtro por tipo
- **Todas** — muestra todos los tipos
- **Copa de Liga** (🏆) — solo `scheduled_match.type = 'CUP_MATCH'` con `competition.name = 'Copa de Liga'`
- **Duelo Diario** (⚔) — solo `scheduled_match.type = 'CW_DAILY'`
- El tab activo tiene un estilo visual diferenciado

### RF-PENDIENTES-03: Tarjeta de batalla pendiente (PendingBattleCard)
Cada tarjeta muestra:
- **Nombre del rival** (grande, prominente)
- **Tipo de batalla** (etiqueta o ícono)
- **Countdown de tiempo límite**: usar `deadline_at` como límite y `scheduled_from/scheduled_to` como ventana visible
  - Si `deadline_at` ya pasó: mostrar en rojo "⚠ Expirado"
  - Si no hay `deadline_at`: mostrar "Sin horario fijado"
- Si `player_b_id` es `NULL` (caso `CW_DAILY`), mostrar un label neutro como "Rival por confirmar" en lugar de inventar un rival interno
- **Botón Reportar** (ícono ✏ `edit_square`) — v0.1: placeHolder (no funcional, visible en diseño)
- **Botón Vincular** (ícono 🔗 `link`) — abre `VincularBatallaPanel` con el contexto de esa batalla

### RF-PENDIENTES-04: Estado vacío
- Cuando no hay batallas pendientes (tab activo sin resultados): mostrar "No tienes batallas pendientes 🎉"

### RF-PENDIENTES-05: Badge de count en navigation
- El ícono de Batallas en `BottomNav` muestra un badge numérico con la cantidad de pendientes (si > 0)

### RF-PENDIENTES-06: Actualización en tiempo real (fase 2)
- v0.1: carga al montar, botón refresh manual
- Fase 2: Supabase realtime subscription para actualizar cuando cambia el estado de una batalla

---

## Componentes UI

```
BatallasPendientes
├── Header
│   ├── "Batallas Pendientes"
│   ├── [BellIcon] notificaciones
│   └── [GridViewIcon] cambio de vista
├── TypeFilterTabs [Todas | Copa de Liga | Duelo Diario]
├── PendingBattlesList
│   └── PendingBattleCard × N
│       ├── RivalName
│       ├── BattleTypeBadge
│       ├── CountdownTimer (o "Sin horario fijado")
│       ├── [EditIcon] Reportar (placeholder)
│       └── [LinkIcon] Vincular → abre VincularBatallaPanel
├── EmptyState (si no hay pendientes)
└── BottomNav
```

---

## Lógica del Countdown

```javascript
function formatCountdown(deadlineAt) {
  if (!deadlineAt) return 'Sin horario fijado';
  const diff = new Date(deadlineAt) - new Date();
  if (diff <= 0) return { text: '⚠ Expirado', urgent: true };
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (days > 0) return `Límite dentro de ${days} días, ${hours} horas, ${minutes} min`;
  if (hours > 0) return `Límite dentro de ${hours} horas, ${minutes} min`;
  return { text: `⚠ Límite dentro de ${minutes} min`, urgent: true };
}
```

---

## Casos de Prueba

| # | Escenario | Resultado Esperado |
|---|-----------|-------------------|
| 1 | 3 batallas pendientes (2 Copa, 1 Duelo) | Las 3 aparecen en tab "Todas" |
| 2 | Filtrar por "Copa de Liga" | Solo las 2 de copa |
| 3 | Match sin `deadline_at` | Muestra "Sin horario fijado" |
| 4 | Match con `deadline_at` a 2 días | Muestra "Límite dentro de 2 días, X horas, Y min" |
| 5 | Match con `deadline_at` pasado | Muestra "⚠ Expirado" en rojo |
| 6 | Click en "Vincular" | Abre VincularBatallaPanel para esa batalla |
| 7 | No hay batallas pendientes | Muestra mensaje de estado vacío |
| 8 | Badge en BottomNav | Muestra "3" cuando hay 3 pendientes |
