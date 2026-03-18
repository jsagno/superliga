# Feature: BattleDetailModal (Icono Ojo)

**Producto:** liga-jugador  
**Archivo objetivo:** `packages/liga-jugador/src/components/BattleDetailModal.jsx`  
**Referencia:** `packages/liga-admin/src/components/BattleDetailModal.jsx`  
**Estado:** 🔴 Por implementar

---

## Descripción

Modal de detalle de batalla reutilizable que se activa desde el **icono ojo (👁)** en el Histórico de Batallas y en el Panel de Asociar Batallas. Muestra el desglose completo de una batalla: resultado, rondas, mazos usados y coronas.

El comportamiento es **idéntico al `BattleDetailModal` de `liga-admin`**, adaptado para el diseño visual del portal del jugador.

---

## Ubicaciones del Icono Ojo

| Pantalla | Cuándo aparece | Acción |
|----------|---------------|--------|
| Histórico de Batallas (`HistorialBatallas`) | En cada `BattleCard` de la lista | Abre modal con `battleId` |
| Panel Asociar Batallas (`VincularBatallaPanel`) | En cada `BattleSelectItem` de la lista | Abre modal con `battleId` |

---

## Requerimientos Funcionales

### RF-MODAL-01: Disparo del modal
- El icono `<Eye size={18} />` (Lucide React) aparece en cada fila/card de batalla
- Al hacer click: el parent llama a `onViewDetail(battleId)` o similar
- El modal se monta con el `battleId` como prop y carga sus propios datos

### RF-MODAL-02: Datos del modal
Al recibir `battleId`, el modal carga:
1. Datos de la batalla: tipo, modo, fecha/hora, jugadores
2. Lista de rondas: `battle_round[]` con `battle_round_id`, `battle_id`, `round_no`
3. Detalle por jugador en cada ronda: `battle_round_player[]` con `player_id`, `side`, `crowns`, `opponent_crowns`, `deck_cards`, `elixir_avg`, `opponent`

### RF-MODAL-03: Contenido del modal
**Header:**
- Tipo y modo de batalla (ej. "Duelo de Guerra" / "Copa de Liga")
- Fecha y hora de la batalla (formateada)
- Botón ✕ para cerrar

**Resultado general:**
- Resultado: "Victoria" (verde) o "Derrota" (rojo) desde la perspectiva del jugador autenticado
- Score total de coronas: ej. "🏆 3 - 1"
- Nombre del rival

**Rondas detalladas:**
- Por cada ronda:
  - Número de ronda
  - Resultado (quién ganó la ronda)
  - Score de coronas de la ronda
  - Mazo del jugador (imágenes de cartas, o íconos placeholder si no disponibles)
  - Mazo del rival (si disponible en `battle_round_player`)

### RF-MODAL-04: Cierre del modal
- Botón ✕ en el header
- Click en el overlay (fuera del área del modal)
- Tecla Escape
- Al cerrar: el modal se desmonta limpiamente, `selectedBattleId` vuelve a `null`

### RF-MODAL-05: Accesibilidad
- El modal debe tener `role="dialog"` y `aria-modal="true"`
- Al abrir: el foco se mueve al interior del modal (focus trap)
- Al cerrar: el foco vuelve al elemento que lo abrió

### RF-MODAL-06: Estado de carga
- Mientras se cargan los datos: spinner o skeleton dentro del modal
- Si la carga falla: mensaje de error con opción de cerrar

---

## Componentes UI

```
BattleDetailModal
├── Overlay (click to close)
└── Dialog
    ├── Header
    │   ├── BattleType + Mode label
    │   ├── Fecha/hora
    │   └── [XIcon] cerrar
    ├── ResultSummary
    │   ├── ResultBadge (Victoria/Derrota)
    │   ├── CrownScore ("3 - 1")
    │   └── RivalName
    ├── RoundsList
    │   └── RoundDetail × N
    │       ├── "Ronda N"
    │       ├── RoundResult + crowns
    │       ├── PlayerDeck (iconos de cartas del jugador)
    │       └── RivalDeck (iconos de cartas del rival)
    └── [LoadingSpinner o ErrorMessage]
```

---

## Implementación

Este componente es una **adaptación** del `BattleDetailModal` existente en `liga-admin`. Los pasos son:

1. Copiar la lógica de fetching de `liga-admin/src/components/BattleDetailModal.jsx`
2. Adaptar las clases CSS/Tailwind al tema oscuro del portal del jugador
3. Asegurar que los queries usan el `supabaseClient` de `liga-jugador`

En una fase posterior se puede refactorizar a `shared/ui/BattleDetailModal` para eliminar la duplicación.

---

## Props del Componente

```typescript
interface BattleDetailModalProps {
  battleId: string;           // ID de la batalla a mostrar
  onClose: () => void;        // Callback para cerrar el modal
  viewerPlayerId?: string;    // player_id del jugador autenticado (para determinar Victoria/Derrota)
}
```

---

## Casos de Prueba

| # | Escenario | Resultado Esperado |
|---|-----------|-------------------|
| 1 | Abrir modal para batalla ganada | Muestra "Victoria" en verde, score correcto |
| 2 | Abrir modal para batalla perdida | Muestra "Derrota" en rojo, score correcto |
| 3 | Batalla con 2 rondas | Muestra 2 rondas con detalle |
| 4 | Batalla con 3 rondas | Muestra 3 rondas con detalle |
| 5 | Click en overlay | Modal se cierra |
| 6 | Presionar Escape | Modal se cierra |
| 7 | Error cargando la batalla | Mensaje de error dentro del modal |
| 8 | Abrir desde Histórico y desde Panel Vincular | Funciona igual en ambos contextos |
