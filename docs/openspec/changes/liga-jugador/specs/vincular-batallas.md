# Feature: Asociar Batallas (Panel "Vincular")

**Producto:** liga-jugador  
**Stitch Screen ID:** `133ac58ba0a3448ea275c9387fd41cb2`  
**Archivo objetivo:** `packages/liga-jugador/src/components/VincularBatallaPanel.jsx`  
**Estado:** 🔴 Por implementar

---

## Descripción

Panel deslizable desde la parte inferior (bottom sheet) que se abre cuando el jugador hace click en el botón **"Vincular"** de una batalla pendiente. Permite seleccionar batallas recientes no vinculadas vs. ese rival específico y asociarlas al enfrentamiento programado.

---

## Diseño Visual

![Asociar Batallas](https://lh3.googleusercontent.com/aida/AOfcidX74GLmVIKa2LdoYD6cMRcUS9UeUk4Zo_IjaSiNTVydWt4UeTeWHsKjT6eaLaXWfv_hL0gfQopOswE3JOwjyBqXUPuPJoBkKtl3TrlwLuPGEoAUEc4hzpfHAD5Tg5N0eMT5fO0S_4x-SZ02SLhxqpbEZKleuXrBp2kClSHRFvfLu_sCbBAYv40xzY4S66PlVcDExualdMB7fB9ASbj8qnQFStVe7maxWhE79_8Zdgi4VZKI7MlU2fT9suw)

---

## Requerimientos Funcionales

### RF-VINCULAR-01: Apertura del panel
- Se abre desde el botón "Vincular" en `BatallasPendientes`
- Recibe como props: `scheduledMatchId`, `rivalName`, `rivalTag`, `matchContext`
- El panel desliza desde abajo con animación suave (transform translateY)
- El fondo detrás del panel tiene overlay semitransparente oscuro

### RF-VINCULAR-02: Header del panel
- Texto: "Histórico de Batallas" (título del panel) y "Vinculando a: [rivalName]" (subtítulo)
- Botón ✕ para cerrar el panel sin vincular

### RF-VINCULAR-03: Lista de batallas no vinculadas
- Cargar las últimas **N batallas** (máx. 10) del historial del jugador que **aún no están vinculadas** a ningún `scheduled_match`
- Si `scheduled_match.player_b_id` existe: filtrar batallas entre ambos jugadores internos
- Si `scheduled_match.player_b_id` es `NULL` (`CW_DAILY`): filtrar batallas 1v1 recientes del jugador dentro de la ventana `scheduled_from` → `deadline_at`
- Subtítulo: "Mostrando últimas N batallas no vinculadas"
- Si no hay batallas disponibles: mensaje "No se encontraron batallas recientes contra este rival"

### RF-VINCULAR-04: Ítem de batalla en el panel
Cada batalla muestra:
- **Checkbox** de selección (activar/desactivar)
- **Resultado**: ✓ "Victoria" (verde) / ✗ "Derrota" (rojo) + tipo de batalla (1vs1, etc.)
- **Score de coronas**: ej. "3 - 1"
- **Tiempo relativo**: ej. "Hace 23 min", "Hace 1 hora", "Hace 3 horas"
- **Icono Ojo 👁** (`<Eye />` de Lucide): al hacer click abre `BattleDetailModal` con el detalle completo de esa batalla

### RF-VINCULAR-05: Footer del panel (sticky)
- Contador: "Seleccionadas: X de Y"
- Botón **"Vincular Batallas"**:
  - Deshabilitado cuando X = 0
  - Habilitado cuando X ≥ 1
  - Al hacer click: ejecuta la vinculación

### RF-VINCULAR-06: Acción de vinculación
Al confirmar:
1. Llamar a `linkBattlesToScheduledMatch(scheduledMatchId, selectedBattleIds[], appUserId)`
2. La función inserta filas en `scheduled_match_battle_link`, registra `linked_by_player = app_user.id`, y actualiza `scheduled_match.status = 'LINKED'`
3. Cerrar el panel
4. Actualizar la lista de batallas pendientes (retirar la batalla completada)
5. Mostrar toast de confirmación: "✓ Batalla vinculada correctamente"

### RF-VINCULAR-07: Manejo de errores
- Si la vinculación falla: mostrar mensaje de error, dejar el panel abierto, permitir reintentar
- No cerrar el panel ni deseleccionar las batallas en caso de error

---

## Componentes UI

```
VincularBatallaPanel (bottom sheet)
├── Overlay (click para cerrar)
├── Sheet
│   ├── Header
│   │   ├── "Histórico de Batallas" (título)
│   │   ├── "Vinculando a: [rivalName]" (subtítulo)
│   │   └── [XIcon] cerrar
│   ├── Subtitle "Mostrando últimas N batallas no vinculadas"
│   ├── BattleSelectList (scrollable)
│   │   └── BattleSelectItem × N
│   │       ├── Checkbox
│   │       ├── ResultBadge (✓ Victoria / ✗ Derrota) + tipo
│   │       ├── Score "X - Y"
│   │       ├── RelativeTime
│   │       └── [EyeIcon] → BattleDetailModal
│   └── StickyFooter
│       ├── "Seleccionadas: X de Y"
│       └── [Button] "Vincular Batallas" (disabled si X=0)
└── BattleDetailModal (cuando icono ojo está activo)
```

---

## Interfaz de battlesService.js

```javascript
// Obtener batallas no vinculadas del jugador vs rival
async function fetchUnlinkedBattles(matchContext, limit = 10) {
  // Si hay player_b_id: buscar batallas entre ambos player_id a través de battle_round_player
  // Si no hay player_b_id: buscar batallas 1v1 del jugador dentro de la ventana del scheduled_match
  // Excluir batallas ya vinculadas a un scheduled_match
  // Ordenar por battle_time DESC
  // Retornar: { id, result, crowns_me, crowns_rival, battle_time, type, mode }
}

// Vincular batallas seleccionadas a un enfrentamiento programado
async function linkBattlesToScheduledMatch(scheduledMatchId, battleIds, appUserId) {
  // 1. INSERT INTO scheduled_match_battle_link (scheduled_match_id, battle_id, linked_by_player)
  // 2. UPDATE scheduled_match SET status = 'LINKED' WHERE scheduled_match_id = scheduledMatchId
  // 3. No escribir scheduled_match_result ni score_a/score_b desde el portal del jugador
}
```

---

## Casos de Prueba

| # | Escenario | Resultado Esperado |
|---|-----------|-------------------|
| 1 | Click en "Vincular" en una batalla pendiente | Panel se abre con lista de batallas vs. ese rival |
| 2 | No hay batallas recientes vs. el rival | Mensaje "No se encontraron batallas" |
| 3 | Seleccionar 2 batallas y hacer click en "Vincular Batallas" | Vincula, cierra panel, retira del pendiente, muestra toast |
| 4 | Hacer click en icono ojo de una batalla | Abre BattleDetailModal con el detalle de esa batalla |
| 5 | 0 batallas seleccionadas | Botón "Vincular Batallas" deshabilitado |
| 6 | Cerrar panel con ✕ sin seleccionar | Panel se cierra sin cambios |
| 7 | Error en la vinculación (red caída) | Mensaje de error, panel permanece abierto, selección intacta |
