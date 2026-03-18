# Feature: Histórico de Batallas Propias

**Producto:** liga-jugador  
**Stitch Screen ID:** `dfd831b5ce054c28957e9ce253aced7d`  
**Archivo objetivo:** `packages/liga-jugador/src/pages/HistorialBatallas.jsx`  
**Estado:** 🔴 Por implementar

---

## Descripción

Vista completa del historial de batallas jugadas por el jugador autenticado. Permite filtrar por temporada y tipo de batalla, muestra estadísticas globales, y ofrece acceso al detalle de cada batalla mediante el **icono ojo (👁)**.

---

## Diseño Visual

![Histórico](https://lh3.googleusercontent.com/aida/AOfcidVX-OVmOTKghFJU-GafPsqkFbFPQwdbAp1_DFXxsKDD-LUskzVMl_8XA3LYbyunoOd4znx6XhAApVsV0sTcMctXwDhV-2UvXZmGfHKT2Bd7lWqbsWWm_isRZOzLERUGZEPlOlwJOnQrmb7zQI1l8PsgTGQOBoiIGeSRMN0ve4hqXKccOYCA-pXpr9gFo3S0lGrzbxswggNC8yxGS7bCRd_RmUhE4To64EAmF3vTZ-fAGPXG78lVZGG2Crk)

---

## Requerimientos Funcionales

### RF-HISTORIAL-01: Header y navegación
- Título "Histórico" en el header
- Botón ← (atrás) que regresa a `/batallas` o al historial de navegación

### RF-HISTORIAL-02: Selector de temporada
- Dropdown expandible con lista de temporadas disponibles
- Por defecto: la temporada activa
- Al cambiar: recargar el historial con los filtros aplicados

### RF-HISTORIAL-03: Tabs de tipo de batalla
- **Todos** — sin filtro de tipo
- **Duelo de Guerra** (⚔) — solo batallas de tipo `DAILY_DUEL` o equivalente
- **Copa de Liga** (🏆) — solo batallas de tipo `LIGA_CUP` o equivalente
- **Copa Revenge** — solo batallas de tipo `REVENGE_CUP` o equivalente
- El tab activo tiene estilo visual diferenciado

### RF-HISTORIAL-04: Estadísticas globales
Badges de resumen al tope, calculados sobre los filtros actuales (temporada + tipo):
- **Total**: número total de batallas en el filtro
- **Victorias**: cantidad de victorias
- **Win Rate**: porcentaje (ej. "65%")

### RF-HISTORIAL-05: Lista de batallas recientes (BattleCard)
- Sección "Batallas Recientes" con lista scrollable
- Cada `BattleCard` muestra:
  - **Ícono de tipo** (⚔ para duelo, 🏆 para copa, etc.)
  - **"vs. [nombre del rival]"**
  - **Score**: ej. "2 - 0"
  - **Tipo específico**: ej. "Duelo de Guerra", "Copa de Liga"
  - **Tiempo relativo**: ej. "Hace 2h", "Ayer", "12 Oct"
  - **Icono Ojo 👁** (`<Eye />` de Lucide) — al hacer click abre `BattleDetailModal` con el detalle completo
  - Chevron `>` derecho (opcional: expandir inline en fase 2; en v0.1 solo el ojo)

### RF-HISTORIAL-06: Carga progresiva (infinite scroll)
- Cargar las primeras 20 batallas al abrir
- Al hacer scroll al final: mostrar spinner "Cargando más batallas…" y cargar el siguiente batch
- Cuando no hay más batallas: dejar de mostrar el spinner

### RF-HISTORIAL-07: Estado vacío
- Si no hay batallas para los filtros aplicados: "No se encontraron batallas con estos filtros"

---

## Componentes UI

```
HistorialBatallas
├── Header
│   ├── [BackArrowIcon] ←
│   └── "Histórico"
├── SeasonSelector (dropdown)
├── TypeTabs [Todos | Duelo de Guerra | Copa de Liga | Copa Revenge]
├── StatsBadges
│   ├── "Total: N Victorias"
│   ├── "N batallas"  (o "N jugadas")
│   └── "Win Rate X%"
├── "Batallas Recientes" (sección)
├── BattleList (scrollable, infinite)
│   └── BattleCard × N
│       ├── TypeIcon
│       ├── "vs. [rival]"
│       ├── Score
│       ├── TypeLabel + RelativeTime
│       └── [EyeIcon] → BattleDetailModal
├── LoadingSpinner ("Cargando más batallas…")
└── BattleDetailModal (cuando icono ojo activo)
```

---

## Interfaz de battlesService.js (lecturas)

```javascript
// Historial con paginación
async function fetchPlayerBattleHistory(playerId, { seasonId, type, page = 0, pageSize = 20 }) {
  // Resolver battle ids a través de battle_round_player -> battle_round -> battle
  // Filtrar por type si aplica (CW_DAILY por scheduled_match.type o competencia enlazada)
  // Filtrar por seasonId usando scheduled_match_battle_link/scheduled_match cuando exista vínculo
  // Ordenar por battle_time DESC
  // Retornar: { battles: [...], hasMore: bool }
}

// Stats globales
async function fetchPlayerGlobalStats(playerId, { seasonId, type }) {
  // Contar victorias, total, calcular win rate desde battle_round_player/battle_round
  // Agrupar sobre los mismos filtros del historial
}
```

---

## Lógica del Icono Ojo

El icono ojo es el punto de acceso al `BattleDetailModal`. Al hacer click:
1. `HistorialBatallas` pasa `battleId` al estado `selectedBattleId`
2. `BattleDetailModal` se monta con `battleId` como prop
3. El modal carga rondas y detalle de la batalla
4. Al cerrar modal → `selectedBattleId = null`

```jsx
// En BattleCard:
<button onClick={() => onViewDetail(battle.id)} aria-label="Ver detalle de batalla">
  <Eye size={18} className="text-blue-400 hover:text-blue-300" />
</button>

// En HistorialBatallas:
{selectedBattleId && (
  <BattleDetailModal
    battleId={selectedBattleId}
    onClose={() => setSelectedBattleId(null)}
  />
)}
```

---

## Casos de Prueba

| # | Escenario | Resultado Esperado |
|---|-----------|-------------------|
| 1 | Cargar historial temporada activa | Lista de batallas ordenadas por más reciente |
| 2 | Filtrar por "Duelo de Guerra" | Solo duelos de guerra en la lista |
| 3 | Cambiar temporada | Lista se recarga con batallas de esa temporada |
| 4 | Click en icono ojo de batalla | BattleDetailModal se abre con info de esa batalla |
| 5 | Scroll al final de la lista | Carga más batallas, spinner visible |
| 6 | No más batallas | Spinner desaparece, no se carga más |
| 7 | 0 batallas en la temporada seleccionada | "No se encontraron batallas con estos filtros" |
| 8 | Win Rate con 0 batallas | No lanzar error de división por cero, mostrar "0%" |
