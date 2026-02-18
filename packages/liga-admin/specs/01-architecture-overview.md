# Documentación de Arquitectura - Liga Admin

## 1. Visión General del Sistema

### 1.1 Descripción
**Liga Admin** es una aplicación de administración web para gestionar una liga interna de Clash Royale. Permite administrar temporadas, equipos, jugadores, batallas, competencias y estadísticas.

### 1.2 Stack Tecnológico

```
Frontend:
├── React 19.2.0 (UI Library)
├── Vite 7.2.4 (Build Tool)
├── React Router DOM 7.11.0 (Routing)
├── Tailwind CSS 4.1.18 (Styling)
├── @dnd-kit/* (Drag & Drop)
└── Lucide React (Icons)

Backend/Database:
├── Supabase (BaaS - PostgreSQL)
└── @supabase/supabase-js 2.89.0 (Client)

Development:
├── ESLint (Linting)
└── PostCSS (CSS Processing)
```

### 1.3 Arquitectura Actual

```
┌─────────────────────────────────────────────────────────┐
│                    Browser (SPA)                         │
├─────────────────────────────────────────────────────────┤
│  React Components (Pages + Components)                  │
│  ├── Direct Supabase Calls (in components)              │
│  ├── useState/useEffect hooks                            │
│  └── useMemo for computed data                           │
├─────────────────────────────────────────────────────────┤
│  Context API                                             │
│  └── AuthContext (session management)                    │
├─────────────────────────────────────────────────────────┤
│  Supabase Client (singleton)                             │
│  └── Direct database access                              │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│              Supabase (Backend as a Service)             │
├─────────────────────────────────────────────────────────┤
│  PostgreSQL Database                                     │
│  ├── Tables: season, player, team, battle, etc.         │
│  ├── RLS (Row Level Security)                           │
│  └── Relationships & Constraints                         │
├─────────────────────────────────────────────────────────┤
│  Auth Service                                            │
│  └── Email/Password authentication                       │
└─────────────────────────────────────────────────────────┘
```

## 2. Estructura de Directorios

```
liga-admin/
├── src/
│   ├── app/
│   │   └── routes.jsx              # Definición de rutas
│   ├── components/
│   │   ├── AdminLayout.jsx         # Layout principal
│   │   ├── ProtectedRoute.jsx      # Guard de autenticación
│   │   ├── BattleDetailModal.jsx   # Modal de detalles
│   │   └── ScheduledMatchEditModal.jsx
│   ├── context/
│   │   └── AuthContext.jsx         # Contexto de autenticación
│   ├── lib/
│   │   └── supabaseClient.js       # Cliente Supabase singleton
│   ├── pages/
│   │   └── admin/                  # Páginas de administración (32 archivos)
│   │       ├── LoginAdmin.jsx
│   │       ├── DashboardAdmin.jsx
│   │       ├── SeasonsList.jsx
│   │       ├── PlayersList.jsx
│   │       └── ... (28 más)
│   ├── main.jsx                    # Entry point
│   └── index.css                   # Estilos globales
├── database/                       # Scripts SQL
├── tools/                          # Utilidades y scripts
├── public/
└── [config files]                  # vite, tailwind, eslint, etc.
```

## 3. Capas de Arquitectura

### 3.1 Capa de Presentación (UI)
**Ubicación**: `src/pages/admin/*.jsx`, `src/components/*.jsx`

**Responsabilidades**:
- Renderizado de UI
- Manejo de eventos de usuario
- Gestión de estado local
- **⚠️ Lógica de negocio** (problema arquitectural)
- **⚠️ Acceso directo a datos** (problema arquitectural)

### 3.2 Capa de Contexto
**Ubicación**: `src/context/AuthContext.jsx`

**Responsabilidades**:
- Gestión de sesión de usuario
- Estado global de autenticación
- Sincronización con Supabase Auth

### 3.3 Capa de Datos
**Ubicación**: `src/lib/supabaseClient.js`

**Responsabilidades**:
- Configuración del cliente Supabase
- **❌ NO HAY CAPA DE ABSTRACCIÓN** (problema crítico)

### 3.4 Capa de Backend
**Supabase (externo)**

**Responsabilidades**:
- Base de datos PostgreSQL
- Autenticación
- Row Level Security
- Realtime subscriptions (no utilizado actualmente)

## 4. Modelo de Datos (Simplificado)

### 4.1 Entidades Principales

```
Era (1) ──< (N) Season
Season (1) ──< (N) SeasonZone
SeasonZone (1) ──< (N) SeasonZoneTeam
SeasonZoneTeam (1) ──< (N) SeasonZoneTeamPlayer
Player (N) ──< (1) SeasonZoneTeamPlayer
Team (1) ──< (N) SeasonZoneTeam

Season (1) ──< (N) ScheduledMatch
ScheduledMatch (1) ──< (N) ScheduledMatchBattleLink
ScheduledMatchBattleLink (N) ──> (1) Battle
Battle (1) ──< (N) BattleRound
BattleRound (1) ──< (N) BattleRoundPlayer

Competition (1) ──< (N) CompetitionStage
CompetitionStage (1) ──< (N) CompetitionGroup
```

### 4.2 Tablas Clave

| Tabla | Propósito | Relaciones Principales |
|-------|-----------|------------------------|
| `era` | Períodos temporales globales | → season |
| `season` | Temporadas de la liga | → season_zone, scheduled_match |
| `player` | Jugadores | → season_zone_team_player |
| `team` | Equipos | → season_zone_team |
| `battle` | Batallas de Clash Royale | → battle_round |
| `scheduled_match` | Partidos programados | → scheduled_match_battle_link, scheduled_match_result |
| `competition` | Competencias (copas) | → competition_stage |

## 5. Flujo de Datos

### 5.1 Flujo Típico de Lectura

```
User Action (click/load)
    ↓
Component (useEffect)
    ↓
Direct Supabase Query (await supabase.from(...))
    ↓
State Update (setState)
    ↓
Re-render
```

### 5.2 Flujo Típico de Escritura

```
User Action (form submit)
    ↓
Component Handler (async function)
    ↓
Data Validation (inline)
    ↓
Direct Supabase Mutation (insert/update/delete)
    ↓
Success/Error Handling (alert)
    ↓
Refresh Data (reload query)
```

## 6. Patrones Actuales

### 6.1 Patrones Utilizados

✅ **Context API** - Para autenticación global
✅ **Protected Routes** - Para control de acceso
✅ **React Router** - Para navegación SPA
✅ **useMemo** - Para datos computados
✅ **useEffect** - Para efectos secundarios

### 6.2 Anti-Patrones Detectados

❌ **Fat Components** - Componentes con 500-1000+ líneas
❌ **No Separation of Concerns** - UI + lógica + datos mezclados
❌ **Direct DB Access in UI** - Sin capa de abstracción
❌ **No Error Boundaries** - Errores no manejados globalmente
❌ **No Loading States Management** - Loading ad-hoc en cada componente
❌ **alert()** - UX pobre para errores
❌ **No Type Safety** - JavaScript sin TypeScript
❌ **Prop Drilling** - Paso de props a través de múltiples niveles
❌ **Duplicated Logic** - Código repetido entre componentes
❌ **No Testing** - Sin tests unitarios ni E2E

## 7. Autenticación y Autorización

### 7.1 Flujo de Autenticación

```
Login Page
    ↓
supabase.auth.signInWithPassword()
    ↓
AuthContext (session state)
    ↓
ProtectedRoute (route guard)
    ↓
Admin Pages
```

### 7.2 Seguridad

- ✅ Row Level Security (RLS) en Supabase
- ✅ Protected Routes en frontend
- ⚠️ Credenciales expuestas en `.env` (debe estar en .gitignore)
- ❌ No hay roles/permisos granulares en frontend

## 8. Gestión de Estado

### 8.1 Estado Local
- **useState** - Para estado de componente
- **useEffect** - Para sincronización con datos externos
- **useMemo** - Para computación costosa

### 8.2 Estado Global
- **AuthContext** - Único contexto global
- ❌ No hay store global (Redux/Zustand)
- ❌ No hay cache de datos (React Query/SWR)

## 9. Renderizado y Performance

### 9.1 Optimizaciones Actuales
- ✅ useMemo para datos computados
- ✅ Paginación en algunas vistas

### 9.2 Problemas de Performance
- ❌ Re-fetching innecesario en cada navegación
- ❌ No hay cache de queries
- ❌ Componentes no optimizados con React.memo
- ❌ Queries N+1 en varios lugares
- ❌ Carga completa de listas grandes sin virtualización

## 10. Manejo de Errores

### 10.1 Estado Actual
```javascript
if (error) {
  alert("Error: " + error.message);
  return;
}
```

### 10.2 Problemas
- ❌ alert() como único mecanismo
- ❌ No hay error boundaries
- ❌ No hay logging centralizado
- ❌ Errores de red no recuperables
- ❌ No hay retry logic

## 11. Dependencias Externas

### 11.1 Críticas
- **Supabase** - BaaS completo (auth + db)
- **React Router** - Navegación

### 11.2 UI/UX
- **Tailwind CSS** - Utility-first styling
- **Lucide React** - Icons
- **@dnd-kit** - Drag & Drop

## 12. Deploy y Build

### 12.1 Scripts Disponibles
```json
{
  "dev": "vite",           // Desarrollo local
  "build": "vite build",   // Build producción
  "preview": "vite preview" // Preview build local
}
```

### 12.2 Output
- SPA estática (HTML + JS + CSS)
- Puede desplegarse en cualquier host estático
- No requiere servidor Node.js en producción

## 13. Métricas del Proyecto

```
Total Components: ~40
Lines of Code: ~15,000 (estimado)
Database Tables: ~30
API Endpoints: 0 (usa Supabase directamente)
Test Coverage: 0%
TypeScript: No
Documentation: Parcial (READMEs específicos)
```

## 14. Puntos Críticos

### 14.1 Fortalezas
- ✅ Funcional y operativo
- ✅ Stack moderno (React 19, Vite)
- ✅ UI consistente con Tailwind
- ✅ Supabase simplifica backend

### 14.2 Debilidades Críticas
- ❌ **Arquitectura monolítica en frontend**
- ❌ **Sin separación de capas**
- ❌ **Difícil de mantener y escalar**
- ❌ **Sin tests**
- ❌ **Alta deuda técnica**

---

**Fecha de Análisis**: Enero 2026
**Versión del Proyecto**: 0.0.0
