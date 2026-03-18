# OpenSpec Changelog

All notable changes to the LigaInterna system will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

#### LIGA-JUGADOR — Portal del Jugador - March 2026

**Nueva Funcionalidad (Change: `docs/openspec/changes/liga-jugador/`):**
- Nuevo paquete `packages/liga-jugador/` — portal web mobile-first para jugadores
- Autenticación Google OAuth con validación de email pre-autorizado
- Dashboard personal con stats de temporada, zona/liga, y preview de batallas pendientes
- Tabla de posiciones individuales con tabs Liga A/B, filtros de zona, jugador propio resaltado
- Tabla de posiciones de equipos con podio visual de los 3 primeros por zona
- Pantalla de batallas pendientes con countdown, filtros por tipo, y acciones Reportar/Vincular
- Panel "Asociar Batallas": selección de batallas no vinculadas para linkear a enfrentamientos programados
- Histórico personal de batallas con filtros de temporada y tipo, estadísticas globales
- **Icono Ojo (👁) en todas las listas de batallas** para visualizar detalle completo (rondas, mazos, coronas)
- Adaptación de `BattleDetailModal` de liga-admin para uso en el portal del jugador
- Diseños de referencia: Stitch Project `4206610767598271327` (7 pantallas)

#### RES (Card Restrictions) Feature - February 2026

**Core Functionality**:
- Card restriction management for individual players per season
- Bulk restriction creation with multi-player and multi-card selection
- Real-time UI updates via Supabase subscriptions
- Search and zone-based filtering
- Individual and bulk deletion with undo capability
- Complete E2E test coverage (T10.2-T10.9)

**Components**:
- `SeasonRestrictionsList` - View and manage restrictions for a season
- `SeasonRestrictionEdit` - Bulk restriction editor with preview matrix
- `RestrictionCard` - Individual restriction display with delete action
- `PlayerMultiSelect` - Multi-select player picker with search
- `CardGrid` - Multi-select card picker with rarity and evolution support

**Services**:
- `restrictionsService.js` - Data layer for CRUD operations
- Zone-aware player filtering via `season_zone_team_player` joins
- Batch creation (50 restrictions per batch) for performance
- Real-time subscription support

**Database**:
- `season_card_restriction` table with unique constraint on (season_id, player_id, card_id)
- Indexed queries for optimal performance
- Foreign key cascades for data integrity

**Documentation**:
- [RES_FEATURE.md](features/RES_FEATURE.md) - Comprehensive feature documentation
- [RES_PERFORMANCE_AUDIT.md](features/RES_PERFORMANCE_AUDIT.md) - Performance analysis

#### BattlesHistory RES Validation - February 2026

**Functionality**:
- Real-time validation of player deck compliance in war duels
- Visual indicators (🚫 ✓ ✗ ⚠) for restriction violations
- Filter to show only battles with restricted players
- Per-player and aggregate multi-player validation
- Detailed tooltip messages with deck counts

**Implementation**:
- `fetchPlayerRestrictionsConfig(playerId, seasonId)` - Fetch player restrictions
- `validateRestrictionCompliance(deckCards, restrictedCardIds)` - Deck validation
- `validateRestrictionDuel(perRound, restrictedCardIds)` - War duel validation
- RES filter: "Todos" (all battles) vs "Solo con RES" (restricted players only)

**Performance**:
- Parallel loading with Extreme/Risky validation
- Lazy loading per page (not all battles at once)
- Query optimization with indexed lookups
- <50ms validation time per battle

**User Experience**:
- Clear visual feedback on compliance status
- Hover tooltips with detailed validation messages
- Seamless integration with existing Extreme/Risky validation UI
- Filter synchronization with URL state

**Documentation**:
- Added BattlesHistory Integration section to [RES_FEATURE.md](features/RES_FEATURE.md)
- Includes workflows, testing recommendations, and known limitations

#### Duel Reconciliation (Season Scheduling) - February 2026

**Core Functionality**:
- Automatic reconciliation of `CW_DAILY` scheduled matches with season duel boundaries
- Respects player assignment windows (`start_date`/`end_date` in `season_zone_team_player`)
- Creates missing scheduled_match rows within effective window
- Cancels pending matches that fall outside the effective window
- Idempotent operation—safe to run multiple times

**Database Schema Changes**:
- Added `duel_end_date DATE` column to `season` table
- Extended `scheduled_match.status` enum to include `CANCELED` value
- Backfill logic: new seasons default `duel_end_date` to `season_end_at` date or `ladder_start_date`

**UI Updates**:
- Season edit form includes `duel_end_date` date input field
- Validation: `duel_end_date >= duel_start_date`
- Season list displays date range using `duel_end_date` as endpoint
- Reconciliation trigger includes progress modal with counter feedback

**Implementation Details**:
- Effective window computation: `max(duel_start, player_start)` to `min(duel_end, player_end)`
- Date normalization to ISO format (YYYY-MM-DD) to prevent timezone drift
- Batched operations: process all assignments per zone in single pass
- Progress reporting: Created/Skipped/Canceled counters with real-time updates

**Utilities**:
- `duelReconciliation.js` - Reusable date window computation functions
- `dateKey()` - Normalize dates to YYYY-MM-DD format
- `computeEffectiveWindow()` - Calculate intersection of season and player windows
- `generateDateRange()` - Generate all dates in a closed range

**Testing**:
- E2E tests cover: reconciliation on new seasons, idempotent runs, assignment window respect
- Adjacent regression tests: season list navigation, season edit form functionality
- Schema validation: CANCELED status enum and `duel_end_date` column presence

**Files Modified**:
- `supabase/migrations/20260228110000_add_duel_end_date_and_canceled_status.sql`
- `packages/liga-admin/src/pages/admin/SeasonEdit.jsx`
- `packages/liga-admin/src/pages/admin/SeasonsList.jsx` (generateDailyDuels refactored)
- `packages/liga-admin/src/lib/duelReconciliation.js` (new utility module)
- `packages/liga-admin/tests/e2e/duel-reconciliation.spec.js` (new E2E test suite)

**Impact**:
- Admins can now set explicit duel end dates, overriding season end dates for seasonal scheduling flexibility
- Scheduled matches automatically stay in sync with player assignments
- Expired player assignments no longer generate or leave orphaned duel records
- Safe reconciliation workflow enables auditing and cleanup without data loss

### Fixed

#### Zone Filtering in Restrictions List - February 2026

**Issue**: Zone dropdown filter not working - selecting a zone showed no players.

**Root Cause**: Player table does not contain zone_id column; zone assignments stored in `season_zone_team_player` table.

**Solution**:
- Added secondary query to fetch zone data from `season_zone_team_player`
- Created `zoneMap` to associate players with zones
- Updated grouped data structure to include zone_id and zone_name

**Impact**: Zone filtering now correctly displays players assigned to selected zone.

**Files Modified**:
- `restrictionsService.js` - Added zone data fetching logic

#### Image Display in Restriction Cards - February 2026

**Issues Resolved**:

1. **Import Path Error**:
   - Fixed unnamed.png import path from `../../assets/` to `../assets/`
   - RestrictionCard is in `src/components/`, not `src/components/admin/`

2. **Player Image Fallback**:
   - Player table has no image columns (schema confirmed)
   - All players now display unnamed.png as avatar
   - Added onError handler for broken images

3. **Card Image Display**:
   - Card images retrieved from `card.raw_payload.iconUrls.medium`
   - Fallback to shield emoji (🛡️) if image load fails
   - Added onError handlers for graceful degradation

**Visual Result**:
- Player avatars: 40x40px rounded with border
- Card images: 64x96px with rarity-based borders
- No broken images in UI

**Files Modified**:
- `RestrictionCard.jsx` - Fixed import path and added fallback logic
- `restrictionsService.js` - Set image_url to null with schema explanation

## [1.0.0] - 2026-01-24

### Added
- Initial production schema migration
- Core database tables and relationships
- Player, season, team, and battle management

---

## Guidelines for Future Entries

### Categories
- **Added**: New features
- **Changed**: Changes to existing functionality
- **Deprecated**: Soon-to-be removed features
- **Removed**: Removed features
- **Fixed**: Bug fixes
- **Security**: Security vulnerability fixes

### Format
```markdown
#### Feature Name - Date

**Brief Description**

**Details**:
- Bullet point 1
- Bullet point 2

**Files Modified**:
- filepath/to/file.ext

**Impact**: User-facing impact description
```
