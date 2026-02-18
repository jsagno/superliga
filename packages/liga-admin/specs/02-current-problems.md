# Estado Actual: Problemas y Anti-Patrones

## 1. Análisis de Componentes Existentes

### 1.1 Componente Típico Actual

**Ejemplo: `SeasonDailyPoints.jsx`** (583 líneas)

```jsx
export default function SeasonDailyPoints() {
  // ❌ PROBLEMA 1: Demasiadas responsabilidades
  const [loading, setLoading] = useState(true);
  const [season, setSeason] = useState(null);
  const [matches, setMatches] = useState([]);
  const [players, setPlayers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [searchPlayer, setSearchPlayer] = useState("");
  const [filterTeamId, setFilterTeamId] = useState("");

  // ❌ PROBLEMA 2: Lógica de negocio en componente
  async function loadData() {
    // Query directa a Supabase (100+ líneas)
    const { data: seasonData } = await supabase
      .from("season")
      .select("...")
      .eq("season_id", seasonId);
    
    // Más queries anidadas...
    const { data: matchesData } = await supabase.from("scheduled_match")...
    const { data: zonesData } = await supabase.from("season_zone")...
    // ... 5 queries más
  }

  // ❌ PROBLEMA 3: Cálculos complejos en componente
  const gridData = useMemo(() => {
    // 200+ líneas de lógica de negocio
    // Procesamiento de fechas
    // Cálculo de penalizaciones
    // Agrupaciones y transformaciones
  }, [season, matches, players, searchPlayer, filterTeamId]);

  // ❌ PROBLEMA 4: JSX masivo (300+ líneas)
  return (
    <div>
      {/* Header */}
      {/* Filters */}
      {/* Complex table with inline logic */}
    </div>
  );
}
```

### 1.2 Problemas Identificados

#### P1: Fat Components (Componentes Gordos)
```
SeasonDailyPoints.jsx:    583 líneas
BattlesHistory.jsx:      1353 líneas ⚠️ CRÍTICO
SeasonsList.jsx:         ~800 líneas
ScheduledMatches.jsx:    ~900 líneas
```

**Consecuencias**:
- Difícil de leer y entender
- Imposible de testear unitariamente
- Alto acoplamiento
- Duplicación de código
- Difícil mantenimiento

#### P2: No Separation of Concerns

**Mezcla actual**:
```jsx
// TODO EN EL MISMO ARCHIVO
function Component() {
  // Estado UI
  const [loading, setLoading] = useState(true);
  
  // Lógica de negocio
  function calculatePenalty(consecutiveDays) {
    if (consecutiveDays === 1) return -1;
    // ...
  }
  
  // Acceso a datos
  const { data } = await supabase.from("table").select();
  
  // Transformación de datos
  const processed = data.map(item => /* complex logic */);
  
  // Validación
  if (!isValid(value)) {
    alert("Error");
  }
  
  // Renderizado
  return <div>...</div>
}
```

#### P3: Direct Database Access

```jsx
// ❌ ACTUAL: UI accede directamente a DB
function PlayersList() {
  useEffect(() => {
    const { data } = await supabase
      .from("player")
      .select("*")
      .order("nick");
    setPlayers(data);
  }, []);
}

// ❌ Se repite en 30+ componentes
// ❌ Sin abstracción
// ❌ Sin cache
// ❌ Sin optimistic updates
```

#### P4: Error Handling Pobre

```jsx
// ❌ PATRÓN ACTUAL (usado 100+ veces)
const { data, error } = await supabase.from("table").select();
if (error) {
  alert("Error: " + error.message); // UX horrible
  return; // No recovery
}
```

**Problemas**:
- `alert()` bloquea UI
- No hay contexto del error
- No hay retry
- No hay logging
- Usuario no sabe qué hacer

#### P5: Loading States Inconsistentes

```jsx
// Patrón repetido en cada componente
const [loading, setLoading] = useState(true);
setLoading(true);
await fetchData();
setLoading(false);

// Sin skeleton loaders
// Sin loading por sección
// Sin indicadores de progreso
```

#### P6: No Type Safety

```javascript
// ❌ JavaScript puro
function calculatePoints(match) {
  return match.result.points_a; // ¿Existe? ¿Es número?
}

// Sin autocompletado
// Errores en runtime
// Refactors peligrosos
```

## 2. Code Smells Detectados

### 2.1 Duplicación de Código

**Ejemplo 1: Formato de fechas**
```jsx
// Se repite en 15+ archivos
function formatDate(dateStr) {
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}`;
}
```

**Ejemplo 2: Queries similares**
```jsx
// Patrón repetido 40+ veces con variaciones mínimas
const { data } = await supabase
  .from("table")
  .select("*")
  .eq("field", value)
  .order("created_at", { ascending: false });
```

### 2.2 Magic Numbers y Strings

```jsx
// ❌ Sin constantes
if (consecutiveMissed === 1) penalty = -1;
else if (consecutiveMissed === 2) penalty = -2;
else if (consecutiveMissed === 3) penalty = -5;
else penalty = -10;

if (match.type === "CW_DAILY") { /* ... */ }
if (match.stage === "CUP_QUALY") { /* ... */ }
```

### 2.3 Prop Drilling

```jsx
// AdminLayout → SeasonEdit → SeasonZones → SeasonZoneTeams
<SeasonZoneTeams 
  seasonId={seasonId}
  zoneId={zoneId}
  onUpdate={handleUpdate}
  loading={loading}
  setLoading={setLoading}
/>
```

### 2.4 God Objects

```jsx
// match object tiene TODO
const match = {
  scheduled_match_id,
  season_id,
  zone_id,
  competition_id,
  competition_stage_id,
  competition_group_id,
  type,
  stage,
  best_of,
  expected_team_size,
  player_a_id,
  player_b_id,
  day_no,
  scheduled_from,
  scheduled_to,
  deadline_at,
  status,
  linked_battles: [{ battle: { battle_time } }],
  result: { points_a, points_b },
  player_a: { nick, current_tag },
  player_b: { nick, current_tag }
};
```

### 2.5 Callback Hell

```jsx
// BattlesHistory.jsx tiene funciones anidadas
async function loadBattles() {
  const battles = await fetchBattles();
  for (const battle of battles) {
    const rounds = await fetchRounds(battle.id);
    for (const round of rounds) {
      const players = await fetchPlayers(round.id);
      // ...
    }
  }
}
```

## 3. Problemas de Arquitectura

### 3.1 No hay Capas Definidas

```
❌ ACTUAL:
Components → Supabase (directo)

✅ DEBERÍA SER:
Components → Services → Repository → Supabase
```

### 3.2 No hay Abstracción de Datos

```jsx
// ❌ Todos los componentes conocen la estructura de Supabase
const { data } = await supabase
  .from("scheduled_match")
  .select(`
    scheduled_match_id,
    linked_battles:scheduled_match_battle_link!scheduled_match_id(
      battle:battle!battle_id(battle_time)
    )
  `);

// Si cambia Supabase → rompe 30+ archivos
```

### 3.3 Business Logic Dispersa

**Lógica de penalizaciones duplicada**:
- `SeasonDailyPoints.jsx` - cálculo de penalizaciones
- `SeasonsList.jsx` - lógica similar pero diferente
- `ScheduledMatches.jsx` - otra variación

**Debería estar**:
- `services/penalties.js` - lógica centralizada
- Con tests unitarios
- Documentada

### 3.4 No hay State Management Global

```jsx
// Cada componente maneja su propio estado
// No hay cache compartido
// Re-fetch en cada navegación
// No hay optimistic updates
```

## 4. Problemas de Performance

### 4.1 N+1 Queries

```jsx
// ❌ Anti-patrón común
async function loadTeamsAndPlayers(zoneId) {
  const teams = await getTeams(zoneId);
  
  for (const team of teams) {
    const players = await getPlayers(team.id); // N queries!
  }
}
```

### 4.2 Over-fetching

```jsx
// ❌ Trae todos los campos aunque solo use 2
const { data } = await supabase
  .from("player")
  .select("*"); // Trae TODO

// Solo usa: player.nick, player.player_id
```

### 4.3 No hay Memoization Efectiva

```jsx
// ❌ Re-calcula en cada render aunque no cambien dependencias
const filteredPlayers = players.filter(p => 
  p.name.includes(search) // Sin useMemo
);
```

### 4.4 Listas No Virtualizadas

```jsx
// ❌ Renderiza 1000+ filas en DOM
{players.map(player => (
  <PlayerRow key={player.id} player={player} />
))}
```

## 5. Problemas de UX

### 5.1 Error Feedback

```jsx
// ❌ alert() en 2026
alert("Error cargando temporada: " + error.message);
```

### 5.2 Loading States

```jsx
// ❌ Solo muestra "Cargando..." sin contexto
if (loading) {
  return <div>Cargando...</div>;
}
```

### 5.3 No hay Optimistic Updates

```javascript
// Usuario hace acción → espera → ve resultado
// Debería: ve resultado inmediato → si falla se revierte
```

## 6. Problemas de Testing

```javascript
// ❌ ESTADO ACTUAL
Tests: 0
Coverage: 0%

// ❌ POR QUÉ NO SE PUEDE TESTEAR
// 1. Componentes gigantes
// 2. Lógica mezclada con UI
// 3. Supabase hardcodeado
// 4. Sin inyección de dependencias
```

## 7. Problemas de Seguridad

### 7.1 Credenciales Expuestas

```javascript
// ❌ .env en repositorio (si no está en .gitignore)
VITE_SUPABASE_URL=https://...
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

### 7.2 No hay Rate Limiting

```jsx
// ❌ Usuario puede spammear requests
<button onClick={loadData}>Refresh</button>
```

### 7.3 Validación Solo en Frontend

```jsx
// ❌ Validación solo en UI
if (!email.includes("@")) {
  alert("Email inválido");
  return;
}
// Backend (RLS) debería validar también
```

## 8. Problemas de Mantenibilidad

### 8.1 Documentación Insuficiente

```javascript
// ❌ Sin JSDoc
function calculateBattleResult(battle, playerId, battleDate, bestOf) {
  // ¿Qué retorna?
  // ¿Qué puede fallar?
  // ¿Cuándo usar?
}
```

### 8.2 Naming Inconsistente

```javascript
// Mezcla de convenciones
const { data: seasonData }     // camelCase
const { data: season_zones }   // snake_case
const SZT = await fetch();     // Acrónimo
```

### 8.3 Comentarios de Debug

```javascript
// ❌ Código temporal en producción
console.log("=== BATALLAS DEL JUGADOR DEBUG ===");
const debugPlayerId = "ff82c140-7a65-4ad6-a479-3ed992d97e31";
```

## 9. Debt Técnica Estimada

```
Categoría                 Severidad   Esfuerzo   Impacto
──────────────────────────────────────────────────────────
Arquitectura             CRÍTICA      8 semanas   ALTO
Separation of Concerns   CRÍTICA      6 semanas   ALTO
Testing                  ALTA         4 semanas   MEDIO
Type Safety (TS)         ALTA         3 semanas   ALTO
Error Handling           MEDIA        2 semanas   MEDIO
Performance              MEDIA        3 semanas   MEDIO
Documentation            BAJA         2 semanas   BAJO
──────────────────────────────────────────────────────────
TOTAL                                 28 semanas  

Deuda Técnica Total: ~7 meses de desarrollo
```

## 10. Ejemplos Concretos de Refactor Necesario

### Antes (Actual):
```jsx
// SeasonDailyPoints.jsx - 583 líneas
export default function SeasonDailyPoints() {
  // 50 líneas de estado
  // 200 líneas de queries
  // 200 líneas de lógica
  // 133 líneas de JSX
}
```

### Después (Propuesto):
```jsx
// views/SeasonDailyPoints/index.jsx - 80 líneas
export default function SeasonDailyPoints() {
  const { gridData, loading, error } = useSeasonDailyPoints();
  
  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorBoundary error={error} />;
  
  return <DailyPointsGrid data={gridData} />;
}

// hooks/useSeasonDailyPoints.js - 50 líneas
// services/dailyPointsService.js - 100 líneas
// components/DailyPointsGrid.jsx - 80 líneas
```

---

**Resumen**: El proyecto funciona pero tiene **deuda técnica crítica** que dificulta el mantenimiento y escalabilidad. Requiere refactor arquitectural para ser sostenible a largo plazo.
