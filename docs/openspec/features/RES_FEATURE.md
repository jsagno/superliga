# RES (Card Restrictions) Feature Documentation

## Overview

The **Card Restrictions (RES)** feature enables league administrators to restrict specific cards for individual players during active tournament seasons. This is a core business rule enforcement mechanism for ensuring tournament fairness and managing meta-game balance.

## Business Context

Per [REGALAMENTO.md](../../REGALAMENTO.md), tournaments may require restricting specific cards for specific players:
- Supports tournament-specific competitive balance
- Enforces league-wide rulings on card availability
- Tracks restriction history for audit purposes
- Manages restrictions at player-level granularity per season

## Architecture

### Component Hierarchy

```
SeasonsList (Display seasons)
    ↓ [Navigate to restrictions]
SeasonRestrictionsList (View restrictions for season)
    ├── RestrictionCard (Individual player restrictions)
    ├── Search/Filter UI
    └── [Add/Edit Restrictions]
        ↓
SeasonRestrictionEdit (Bulk restriction editor)
    ├── PlayerMultiSelect (Select affected players)
    ├── CardGrid (Select restricted cards)
    └── ReasonInput (Restriction rationale)
```

### Key Components

#### **1. SeasonRestrictionsList** ([src/pages/admin/seasons/SeasonRestrictionsList.jsx](../../../packages/liga-admin/src/pages/admin/seasons/SeasonRestrictionsList.jsx))

**Purpose**: Display all card restrictions for a specific season

**Features**:
- List organized by player card (grouped by player)
- Search by player name, tag, or card name
- Filter by zone (dropdown selector)
- Clear individual restrictions or all for a player
- Real-time updates via Supabase subscriptions
- Empty state messaging

**Props**:
- `seasonId` (required): UUID of the active season

**Dependencies**:
- `restrictionsService.js` - Data fetching and mutations
- `RestrictionCard.jsx` - Individual restriction rendering
- `supabase` subscriptions for real-time updates

**State Management**:
```javascript
const [restrictions, setRestrictions] = useState([]);
const [searchQuery, setSearchQuery] = useState('');
const [selectedZone, setSelectedZone] = useState('all');
const [loading, setLoading] = useState(false);
```

**Search/Filter Logic**:
- Search across player name, player_tag, and card name (case-insensitive)
- Zone filter applied at data fetch level via SQL query
- Both applied simultaneously (AND logic)

#### **2. SeasonRestrictionEdit** ([src/pages/admin/seasons/SeasonRestrictionEdit.jsx](../../../packages/liga-admin/src/pages/admin/seasons/SeasonRestrictionEdit.jsx))

**Purpose**: Create/edit card restrictions in bulk for multiple players and cards

**Features**:
- Multi-select player picker (search + dropdown)
- Card grid with rarity filtering (including evolution variants)
- Custom reason input (optional)
- Live preview matrix showing all restrictions before apply
- Duplicate detection (highlights existing restrictions)
- Batch creation with error recovery

**Props**:
- `seasonId` (required): UUID of season
- `onSuccess` (optional): Callback after bulk creation

**Workflow**:
1. Page loads with empty player/card selections
2. User selects players from dropdown
3. Card grid displays and user selects cards
4. Preview matrix builds showing all combinations
5. User optionally enters restriction reason
6. Click "Apply" → Confirmation dialog → DB insert

**Preview Matrix**:
- Shows all `players.length × cards.length` combinations
- Displays player name/tag, card image, existing flag
- Color-coded: gray background for duplicates, white for new
- Sorted by player name, then card ID

**Duplicate Detection**:
- Pre-fetches existing restrictions for selected players and season
- Marks duplicates in preview with visual indicator
- Still allows "apply" (backend upsert handles it)
- Duplicate count shown in confirmation dialog

**Card ID Normalization**:
- Evolution variants stored as `card_id_evo` in UI (for selection tracking)
- Normalized to numeric `card_id` before DB insert
- Backend upsert handles duplicates intelligently

#### **3. RestrictionCard** ([src/components/admin/restrictions/RestrictionCard.jsx](../../../packages/liga-admin/src/components/admin/restrictions/RestrictionCard.jsx))

**Purpose**: Display a single card restriction with delete capability

**Features**:
- Card image (32px thumbnail)
- Card name and rarity badge
- Player context (from parent grouping)
- Hover-activated delete button
- Undo capability (toast action)
- Smooth animations

**Props**:
```javascript
restriction: {
  restriction_id: uuid,
  player_id: uuid,
  card_id: bigint,
  card: { name, rarity, icon },
  created_at: timestamp
}
onDelete: (restrictionId) => void
```

#### **4. PlayerMultiSelect** ([src/components/admin/restrictions/PlayerMultiSelect.jsx](../../../packages/liga-admin/src/components/admin/restrictions/PlayerMultiSelect.jsx))

**Purpose**: Select multiple players for restriction application

**Features**:
- Search by name or player tag
- Multi-select with checkmarks
- Clears selections when resetting form
- Sorted alphabetically
- Zone-based filtering via Supabase JOIN query

**Query**:
```sql
SELECT DISTINCT player.player_id, player.player_name, player.player_tag
FROM player
INNER JOIN season_zone ON player.player_id = season_zone.player_id
WHERE season_zone.season_id = ?
ORDER BY player.player_name ASC
```

#### **5. CardGrid** ([src/components/admin/restrictions/CardGrid.jsx](../../../packages/liga-admin/src/components/admin/restrictions/CardGrid.jsx))

**Purpose**: Multi-select card picker with rarity and evolution support

**Features**:
- 7 rarity filters: All, Champion, Legendary, Epic, Rare, Common, **Evolution**
- Filter pill interface (purple for evolution)
- 4-column grid layout
- Card selection with keyboard support
- Evolution variants (dual display: normal + EVO badge)
- Search with debounce (500ms)
- Keyboard navigation (arrow keys)

**Evolution Support**:
- Cards with `hasEvolution=true` show as 2 items in filtered grid
- Normal variant: displays `card.displayIcon`
- EVO variant: displays `card.displayIcon` with purple "EVO" badge
- Selection tracking: `card_id` (normal) vs `${card_id}_evo` (evolution)

**Filter Logic**:
```javascript
const RARITIES = ['all', 'champion', 'legendary', 'epic', 'rare', 'common', 'evolution'];

// When selectedRarity = 'evolution'
filteredCards = cards
  .filter(card => card.hasEvolution)
  .flatMap(card => [
    { ...card, variantId: `${card.card_id}_evo`, displayName: `${card.name} EVO` }
  ])
```

**Rarity Colors**:
- Champion: Gold/Amber
- Legendary: Purple  
- Epic: Blue
- Rare: Green
- Common: Gray
- Evolution: Purple with sparkle emoji

### Data Model

#### **season_card_restriction Table**

```sql
CREATE TABLE season_card_restriction (
  restriction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES season(season_id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES player(player_id) ON DELETE CASCADE,
  card_id BIGINT NOT NULL REFERENCES card(card_id) ON DELETE CASCADE,
  reason TEXT,
  created_by UUID REFERENCES player(player_id),
  created_at TIMESTAMP DEFAULT now(),
  UNIQUE(season_id, player_id, card_id),
  INDEX idx_restriction_season(season_id),
  INDEX idx_restriction_player(player_id),
  INDEX idx_restriction_season_player(season_id, player_id)
);
```

**Key Constraints**:
- `UNIQUE(season_id, player_id, card_id)`: Prevents duplicate restrictions
- Foreign keys cascade on delete
- Indexed for efficient queries by season and player

### Service Layer

#### **restrictionsService.js** ([src/services/restrictionsService.js](../../../packages/liga-admin/src/services/restrictionsService.js))

**Core Functions**:

1. **`fetchRestrictions(seasonId, zoneId, searchQuery)`**
   - Fetches all restrictions for a season
   - Optional zone filtering via zone_id FK
   - Optional search across player name, tag, card name
   - Returns: `Array<{ restriction_id, player_id, player_name, card_id, card_name, ... }>`

2. **`bulkCreateRestrictions(seasonId, restrictions, byUserId)`**
   - Creates multiple restrictions in batch (50 at a time)
   - Normalizes evolution card IDs (`_evo` suffix removal)
   - Upsert on conflict (ignores duplicates)
   - Returns: `{ created: number, failed: array }`

3. **`deleteRestriction(restrictionId)`**
   - Soft delete with 5-second undo window (local only)
   - Hard delete if undo expires
   - Returns: `{ success: bool, error?: string }`

4. **`subscribeToRestrictions(seasonId, callback)`**
   - Real-time subscription via Supabase
   - Listens for INSERT, UPDATE, DELETE
   - Returns: unsubscribe function

5. **`checkExistingRestrictions(seasonId, playerIds, cardIds)`**
   - Pre-fetch duplicate check
   - Returns: `Set<string>` of existing restriction keys

### Hooks

#### **useSeasonRestrictions(seasonId, zoneId, searchQuery)**

```javascript
const {
  restrictions,          // Array of restriction objects
  grouped,              // Grouped by player_id
  loading,              // Boolean
  error,               // Error message or null
  deleteRestriction,   // (restrictionId) => Promise
  deleteAllForPlayer,  // (playerId) => Promise
  refreshList          // () => Promise
} = useSeasonRestrictions(seasonId, zoneId, searchQuery);
```

## User Workflows

### Workflow 1: Viewing Restrictions

```
Admin → Seasons List → Click "Restricciones" button → SeasonRestrictionsList
  ↓ (Page loads)
  - Real-time subscription established
  - Current restrictions displayed grouped by player
  - Search/filter UI visible
  - "Add" button ready for bulk editor
```

### Workflow 2: Creating Restrictions (Bulk)

```
Admin → Click "+ Add" button → SeasonRestrictionEdit
  ↓ (Player selection)
  - Search and select players from dropdown
  ↓ (Card selection)
  - View card grid with rarity filters
  - Click cards to select (checkbox appears)
  - View live preview matrix (all combinations)
  ↓ (Add reason - optional)
  - Type optional restriction reason
  ↓ (Apply)
  - Click "Apply" button
  - Confirmation dialog shows:
    - Player count
    - Card count
    - Total restrictions (players × cards)
    - Duplicate count (if any)
  - User clicks "Confirm"
  ↓ (Backend processing)
  - Batch insert (50 at a time)
  - Unique constraint handles duplicates
  - Success toast appears
  - Auto-navigate back to restrictions list
  - Real-time subscription updates list
```

### Workflow 3: Deleting Restrictions

```
Admin → SeasonRestrictionsList → Hover RestrictionCard
  ↓ (Delete single)
  - Visible hover → delete button appears
  - Click delete button
  - Toast: "Restriction deleted" [Undo]
  - Click "Undo" within 5s to restore
  - After 5s, hard deletion occurs

  ↓ (Delete all for player)
  - Click "Clear All" on player card
  - Confirmation dialog appears
  - Click "Confirm"
  - All restrictions for player deleted
  - Toast: "All restrictions for [player name] deleted"
```

## Testing

### E2E Test Suite: `restrictions.spec.js`

**Test Coverage** (T10.2-T10.9):

| Test ID | Description | Coverage |
|---------|-------------|----------|
| T10.2 | View restrictions list page | Header, season info, search/filter UI |
| T10.3 | Search and filter restrictions | Search execution, result filtering |
| T10.4 | Delete single restriction | Hover state, delete action, undo toast |
| T10.5 | Delete all restrictions | Clear All button, confirmation, success |
| T10.6 | Create bulk restrictions | Multi-step flow, preview, DB insert |
| T10.7 | Duplicate detection | Duplicate handling, second application |
| T10.8 | Validation errors | Error messages for incomplete selections |
| T10.9 | Real-time updates | Subscription initialization |

**Running Tests**:
```bash
PLAYWRIGHT_ADMIN_EMAIL=admin@test.local \
PLAYWRIGHT_ADMIN_PASSWORD=testpass \
npm run test:e2e -- tests/e2e/restrictions.spec.js
```

## Performance Considerations

### Query Optimization

**Fetching Restrictions**:
- Uses indexed queries on `season_id` and `player_id`
- Joins with player and card tables for denormalization
- Zone filtering applied in SQL layer (not memory)
- Search applied via ILIKE filters

**Bulk Creation**:
- Batch processing: 50 restrictions per DB round trip
- Reduces network latency for large operations
- Upsert on conflict avoids error handling complexity

### Caching Strategies

**Client-Side**:
- Supabase subscriptions reduce re-fetches on updates
- Search results debounced (500ms) to avoid excessive queries
- Player list cached after first load (or filter change)

**Server-Side**:
- Database indexes on season_id, player_id, season+player
- Foreign keys with ON DELETE CASCADE (automatic cleanup)

## Security Considerations

### Row-Level Security (RLS)

**Restriction Access**:
- Admins can view/edit all restrictions
- Players cannot directly modify restrictions
- Service role used for batch operations

**Data Validation**:
- Player IDs validated against season_zone membership
- Card IDs validated against card catalog
- Input sanitization on reason field

### Audit Trail

**Created By Tracking**:
- `created_by` field records which admin made the restriction
- Timestamps tracked for historical reference
- Consider adding deletion audit log in future

## BattlesHistory Integration

### Overview

As of **February 2026**, the RES feature integrates with the BattlesHistory page to **validate player compliance** during war duels. This ensures that players with card restrictions are not using those cards in competitive battles.

### Feature Components

#### **RES Validation Functions**

Location: [BattlesHistory.jsx](../../../packages/liga-admin/src/pages/admin/BattlesHistory.jsx)

**Core Functions**:

1. **`fetchPlayerRestrictionsConfig(playerId, seasonId)`**
   ```javascript
   // Fetches all restricted cards for a player in a season
   const config = await fetchPlayerRestrictionsConfig(playerId, seasonId);
   // Returns: { restrictedCardIds: [card_id, ...] } or null
   ```
   - Queries `season_card_restriction` table
   - Returns array of restricted card IDs
   - Returns `null` if player has no restrictions

2. **`validateRestrictionCompliance(deckCards, restrictedCardIds)`**
   ```javascript
   // Checks if deck contains any restricted cards
   const isValid = validateRestrictionCompliance(deckCards, restrictedCardIds);
   // Returns: true (no violations) or false (restricted card used)
   ```
   - Returns `true` if no restricted cards found in deck
   - Returns `false` if any card in deck matches restricted list
   - Returns `true` if no restrictions exist (empty restrictedCardIds)

3. **`validateRestrictionDuel(perRound, restrictedCardIds)`**
   ```javascript
   // Validates all rounds in a war duel
   const validation = validateRestrictionDuel(summary.perRound, restrictedCardIds);
   // Returns: { valid: bool, message: string }
   ```
   - Validates all team decks across all rounds
   - Counts violating decks (those with restricted cards)
   - Returns detailed message with deck counts

**Validation Logic**:
- **War Duels Only**: Multi-round battles (battle_type = 'war' or 'riverRace*')
- **Per-Player Validation**: Each player in battle checked individually
- **All Decks Checked**: Every deck in every round validated
- **No Tolerance Policy**: Any restricted card usage = violation

#### **State Management**

```javascript
const [restrictionConfigs, setRestrictionConfigs] = useState({});
// Structure: { 
//   battle_id: {
//     config: { restrictedCardIds: [...] },
//     validation: { valid: bool, message: string },
//     playerId: uuid (single-player mode)
//   }
//   OR
//   battle_id: {
//     multiPlayer: true,
//     validations: {
//       player_id: { config, validation }
//     }
//   }
// }
```

**Loading Strategy**:
- Loaded in `useEffect` after battle details fetched
- Only loaded for war duels (multi-round battles)
- Requires `activeSeason` context for season_id
- Parallel loading with `extremeConfigs` (Extreme/Risky validation)

#### **RES Filter UI**

Location: BattlesHistory filters section

**Filter Options**:
- **Todos** (default): Show all battles regardless of RES status
- **Solo con RES**: Show only battles where at least one player has card restrictions

**Implementation**:
```javascript
const resFilter = searchParams.get("resFilter") || "all";

// Filter logic in battle fetching
if (resFilter === "withRes" && ids.length > 0 && activeSeason) {
  // Filter battles to only those with players who have restrictions
  const filteredIds = [];
  for (const battle of battleTimes) {
    // Check if any participating player has restrictions
    for (const pid of playerIds) {
      const config = await fetchPlayerRestrictionsConfig(pid, activeSeason.season_id);
      if (config && config.restrictedCardIds.length > 0) {
        filteredIds.push(battle.battle_id);
        break;
      }
    }
  }
  ids = filteredIds;
}
```

#### **Visual Indicators**

**Battle Header Display**:
- **Icon**: 🚫 (prohibition symbol)
- **Checkmark** (✓): Player complied - no restricted cards used (blue, `text-blue-400`)
- **Cross** (✗): Player violated - used at least one restricted card (red, `text-red-400`)
- **Warning** (⚠): Partial compliance in multi-player battles (yellow, `text-yellow-400`)

**Single-Player Mode**:
```jsx
<span className="flex items-center gap-1">
  <span title="RES (Restricciones)">🚫</span>
  {restrictionConfigs[battle.battle_id].validation.valid ? (
    <span className="text-blue-400" title={message}>✓</span>
  ) : (
    <span className="text-red-400" title={message}>✗</span>
  )}
</span>
```

**Multi-Player Mode**:
- Shows aggregate status across all players in battle
- **All valid**: Blue checkmark
- **Some valid, some violations**: Yellow warning
- **All violations**: Red cross

**Tooltip Messages**:
- `"RES: X/Y mazos válidos"` - X valid decks out of Y total
- `"RES: X/Y mazos válidos (Z con cartas restringidas)"` - Shows violation count
- Player count in multi-player mode: `"X jugador(es) sin usar cartas restringidas"`

### User Workflows

#### Workflow 1: Viewing RES Validation

```
Admin → BattlesHistory → Filter by Player/Date
  ↓ (Page loads battles)
  - War duels display RES icon (🚫) if player has restrictions
  - Checkmark (✓) = compliant, Cross (✗) = violation
  - Hover over icon to see detailed validation message
  ↓ (Multi-player battles)
  - Aggregate status shown (all valid, partial, all violations)
  - Expand battle to see per-player validation details
```

#### Workflow 2: Filtering by RES Status

```
Admin → BattlesHistory → RES Filter Dropdown
  ↓ (Select "Solo con RES")
  - Page reloads with only battles where players have restrictions
  - All shown battles display RES validation icon
  - Empty state if no players in filtered set have restrictions
  ↓ (Reset to "Todos")
  - All battles shown again
```

### Performance Considerations

**Query Optimization**:
- RES validation runs in parallel with Extreme/Risky validation
- Only queries restrictions for war duels (skips 1v1 battles)
- Caches restriction configs per battle_id (no redundant queries)
- Filter queries use efficient IN clauses for player_id batches

**Scalability**:
- Expected load: ~10-50 war duels per season
- Expected restrictions per player: 1-10 cards
- Query time: <50ms per battle (indexed on season_id + player_id)
- Network payload: Minimal (only card_id array, no raw_payload)

**Lazy Loading**:
- Validation only loaded on battle detail fetch (page-by-page)
- Not loaded if season is missing or RES feature disabled
- Skipped for battles without participating players

### Testing Recommendations

**E2E Test Cases**:

| Test ID | Description | Validation |
|---------|-------------|------------|
| T11.1 | RES indicator displays on war duels | Icon 🚫 visible with checkmark/cross |
| T11.2 | RES filter shows only restricted players | Battle list filtered correctly |
| T11.3 | RES validation correct for compliant player | Checkmark shown, tooltip message correct |
| T11.4 | RES validation correct for violating player | Cross shown, restricted cards detected |
| T11.5 | Multi-player battles aggregate correctly | Warning shown when mixed compliance |
| T11.6 | RES validation skipped for 1v1 battles | No icon shown, no queries executed |
| T11.7 | Performance under load (100+ battles) | Page load <3s, no UI blocking |

**Manual Test Scenarios**:
1. Create restriction for player
2. View their war battle history
3. Verify icon appears on war duels
4. Check tooltip shows correct validation message
5. Filter by "Solo con RES" and verify results
6. Delete restriction and verify icon disappears

### Known Limitations

1. **Season Dependency**: Requires active season context
   - Will not validate battles if season is null
   - Future: Support multi-season validation

2. **War Duels Only**: Does not validate 1v1 battles
   - Business rule: Restrictions only enforced in war mode
   - Design decision: Keep validation focused on competitive context

3. **No Historical Backfill**: Validation runs on page load only
   - Does not retroactively mark old battles
   - Future: Consider cron job to backfill validation results

4. **Filter Performance**: "Solo con RES" can be slow for large datasets
   - Queries restrictions for all participating players
   - Future: Pre-compute player restriction status per season

## Bug Fixes & Improvements

### Zone Filtering Fix (February 2026)

**Issue**: Zone dropdown filter in SeasonRestrictionsList was not working - selecting a zone showed no players.

**Root Cause**: `restrictionsService.fetchRestrictions()` was not fetching zone information for players. The player table does not have a zone_id column; zone assignments are stored in the `season_zone_team_player` table.

**Solution**:
1. Added secondary query to `season_zone_team_player` table to fetch zone assignments
   ```javascript
   const { data: zoneData } = await supabase
     .from('season_zone_team_player')
     .select('player_id, zone_id, season_zone!inner(season_id, name)')
     .eq('season_zone.season_id', seasonId);
   ```

2. Created `zoneMap` to associate players with their zones:
   ```javascript
   const zoneMap = new Map();
   (zoneData || []).forEach(item => {
     zoneMap.set(item.player_id, {
       zone_id: item.zone_id,
       zone_name: item.season_zone?.name || 'Unknown'
     });
   });
   ```

3. Updated grouped data structure to include zone information:
   ```javascript
   grouped.push({
     player_id: playerId,
     player_name: restrictions[0].player?.name || 'Unknown',
     player_nick: restrictions[0].player?.nick || null,
     zone_id: zoneInfo?.zone_id || null,
     zone_name: zoneInfo?.zone_name || null,
     image_url: null,
     restrictions: restrictions
   });
   ```

**Files Modified**:
- [restrictionsService.js](../../../packages/liga-admin/src/services/restrictionsService.js)

**Impact**: Zone filtering now works correctly, allowing admins to view restrictions by zone.

### Image Display Improvements (February 2026)

**Issue**: Card and player images not displaying in `RestrictionCard` component.

**Solutions Implemented**:

1. **Import Path Fix**:
   - Fixed import path for unnamed.png fallback image
   - Changed from `../../assets/unnamed.png` to `../assets/unnamed.png`
   - Issue: RestrictionCard is in `src/components/`, not `src/components/admin/`

2. **Player Image Fallback**:
   - Player table has no image columns (confirmed via schema review)
   - All players now show unnamed.png as avatar
   - Added onError handler to prevent broken image display

3. **Card Image Display**:
   - Card images retrieved from `card.raw_payload.iconUrls.medium`
   - Fallback to shield emoji (🛡️) if image fails to load
   - Added onError handler for graceful degradation

**Files Modified**:
- [RestrictionCard.jsx](../../../packages/liga-admin/src/components/RestrictionCard.jsx)

**Visual Result**:
- Player avatars: 40x40px rounded circle with border
- Card images: 64x96px with rarity-based borders
- Fallback images prevent broken UI

## Known Limitations & Future Enhancements

### Current Limitations

1. **Batch Size**: Hard-coded to 50 restrictions per batch
   - Adjustable if performance issues arise

2. **Evolution Cards**: Stored as numeric base ID
   - Dual UI display adds complexity to variant tracking
   - Consider separating evolution into distinct table column

3. **No Bulk Edit**: Only create and delete supported
   - Editing requires delete + re-create workflow
   - Could add bulk update in future

4. **No Import/Export**: Manual CSV upload not supported
   - Admin UI only supports web form

### Future Enhancements

1. **Restriction Templates**: Pre-defined restriction sets for common scenarios

2. **Approval Workflows**: Multi-admin approval before enforcement

3. **Time-Based Restrictions**: Restrict cards for specific tournament rounds only

4. **Card Rotation Support**: Restrictions tied to card evolution state

5. **Notification System**: Alert affected players of restrictions

6. **Analytics Dashboard**: Restriction frequency by card/player/season

## Related Documentation

- [REGALAMENTO.md](../../REGALAMENTO.md) - Business rules
- [Data Model](../architecture/data-model.md) - Schema details
- [System Overview](../architecture/system-overview.md) - Architecture
- [Tournament Rules](../business-rules/tournament-rules.md) - Tournament context
- [Player Eligibility](../business-rules/player-eligibility.md) - Player management
