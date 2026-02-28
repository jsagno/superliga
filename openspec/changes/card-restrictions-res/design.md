# Design: Card Restrictions (RES) System

## Overview

The Card Restrictions (RES) system allows administrators to prohibit specific players from using specific cards within a season. This document outlines the technical architecture, data model, UI components, and implementation approach.

## Technical Decisions

### 1. Data Storage

**Decision**: Store restrictions in a new `season_card_restriction` table

**Rationale**:
- Clean separation from existing tables
- Easy to query restrictions per player/season
- Supports historical tracking
- Simplifies bulk operations

**Schema**:
```sql
CREATE TABLE season_card_restriction (
    restriction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    season_id UUID NOT NULL REFERENCES season(season_id),
    player_id UUID NOT NULL REFERENCES player(player_id),
    card_id UUID NOT NULL REFERENCES card(card_id),
    reason TEXT,
    created_by UUID REFERENCES player(player_id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Prevent duplicate restrictions
    UNIQUE(season_id, player_id, card_id)
);

-- Indexes for common queries
CREATE INDEX idx_restriction_season_player ON season_card_restriction(season_id, player_id);
CREATE INDEX idx_restriction_season ON season_card_restriction(season_id);
CREATE INDEX idx_restriction_player ON season_card_restriction(player_id);
```

**Alternatives Considered**:
- JSON array in `season_zone_team_player`: Rejected (poor queryability, no relational integrity)
- Separate table per season: Rejected (maintenance nightmare)

### 2. Card Data Source

**Decision**: Use existing `card` table with `raw_payload` JSON for rarity data

**Rationale**:
- Card data already synchronized from Supercell API
- `raw_payload` contains all necessary metadata (name, rarity, iconUrls)
- No need for additional API calls
- Real-time card catalog updates

**Card Payload Structure**:
```json
{
  "id": 26000072,
  "name": "Archer Queen",
  "rarity": "champion",
  "iconUrls": {
    "medium": "https://api-assets.clashroyale.com/cards/300/..."
  },
  "elixirCost": 5,
  "maxLevel": 6
}
```

**Rarity Values**: `"champion"`, `"legendary"`, `"epic"`, `"rare"`, `"common"`

### 3. UI Architecture

**Decision**: Two-page flow with reusable components

**Pages**:
1. **`/admin/seasons/:seasonId/restrictions`** - List view (RESADMIN.html)
2. **`/admin/seasons/:seasonId/restrictions/edit`** - Bulk editor (RESCARDSELECTION.html)

**Reusable Components**:
- `<CardGrid />` - Visual card selector with filtering
- `<PlayerMultiSelect />` - Searchable player chips
- `<RestrictionCard />` - Player restriction display card

**Why Two Pages**:
- Separation of concerns (view vs. edit)
- Different layouts (list vs. grid)
- Better performance (lazy load edit components)
- Clearer user mental model

### 4. Filtering Strategy

**Decision**: Client-side filtering for cards, server-side for players

**Card Filtering**:
- Client-side (all cards loaded at once, ~100 cards)
- Filter by rarity using `card.raw_payload.rarity`
- Fast, responsive, no network latency

**Player Filtering**:
- Server-side (fuzzy search via Supabase query)
- Only load participants for current season
- Paginated results if needed

**Rationale**:
- Card catalog is small enough for client-side (<5KB)
- Player list can be large (100s of participants)
- Search requires partial matching (better on server)

### 5. Bulk Operations

**Decision**: Batch upsert with transaction

**Flow**:
1. User selects N players
2. User selects M cards
3. Client generates N×M restriction objects
4. Send to Supabase in single `upsert()` call
5. Database handles duplicates via `UNIQUE` constraint

**SQL**:
```javascript
const restrictions = players.flatMap(player =>
  cards.map(card => ({
    season_id: seasonId,
    player_id: player.player_id,
    card_id: card.card_id,
    created_by: currentUser.id,
  }))
);

const { error } = await supabase
  .from('season_card_restriction')
  .upsert(restrictions, { onConflict: 'season_id,player_id,card_id' });
```

**Error Handling**:
- Show success count
- Display failed operations
- Allow retry

### 6. Real-time Updates

**Decision**: Supabase subscriptions for live restriction list

**Implementation**:
```javascript
const subscription = supabase
  .channel(`restrictions:${seasonId}`)
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'season_card_restriction',
      filter: `season_id=eq.${seasonId}`
    },
    (payload) => {
      // Update local state
      handleRestrictionChange(payload);
    }
  )
  .subscribe();
```

**Why**:
- Immediate feedback when other admins make changes
- Avoids stale data
- Better collaborative experience

### 7. Navigation Integration

**Decision**: Add RES tab to bottom navigation in AdminLayout

**Position**: Between "Jugadores" and "Ajustes"

**Icon**: Material Symbol `block` (filled)

**Route Structure**:
```
/admin/seasons/:seasonId/restrictions       -> List view
/admin/seasons/:seasonId/restrictions/edit  -> Bulk editor
```

**Rationale**:
- Consistent with existing navigation pattern
- Visually distinct icon (prohibition symbol)
- Season-scoped (fits existing URL structure)

## Data Flow

### Create Restriction Flow

```
User Action (UI)
    ↓
Select Players (PlayerMultiSelect)
    ↓
Select Cards (CardGrid)
    ↓
Generate Restrictions Array (N×M)
    ↓
Supabase.upsert(restrictions)
    ↓
Database Transaction
    ↓
RLS Policy Check (admin-only)
    ↓
Insert/Update Records
    ↓
Real-time Subscription Fires
    ↓
UI Updates (List View)
```

### View Restrictions Flow

```
Page Load
    ↓
Fetch Season
    ↓
Query Restrictions (with player & card joins)
    ↓
Group by Player
    ↓
Render RestrictionCards
    ↓
Subscribe to Real-time Changes
```

### Delete Restriction Flow

```
User Clicks Delete
    ↓
Confirmation Dialog
    ↓
Supabase.delete(restriction_id)
    ↓
RLS Policy Check
    ↓
Database Delete
    ↓
Subscription Update
    ↓
UI Removes Card
```

## Security Considerations

### Row-Level Security (RLS)

**Policies**:

```sql
-- Admins can create/update/delete restrictions
CREATE POLICY admin_manage_restrictions ON season_card_restriction
  FOR ALL
  USING (
    auth.uid() IN (
      SELECT player_id FROM player WHERE is_admin = TRUE
    )
  );

-- Players can view their own restrictions (future)
CREATE POLICY player_view_own_restrictions ON season_card_restriction
  FOR SELECT
  USING (
    player_id = auth.uid()
  );
```

**Authentication**:
- All RES pages behind `<ProtectedRoute>`
- Requires admin session
- API calls include auth token

## Performance Optimization

### Database

1. **Indexes**: On common query patterns (season+player, season only)
2. **Materialized View**: Pre-join restrictions with player/card for fast list view
3. **Pagination**: Load restrictions incrementally if count > 100

### Frontend

1. **Card Grid Virtualization**: Render only visible cards (if > 100 cards)
2. **Lazy Loading**: Load edit page components only when needed
3. **Debounced Search**: Wait 300ms before server query
4. **Optimistic Updates**: Instantly update UI, rollback on error

### Query Optimization

```sql
-- Efficient query for list view
SELECT 
  p.player_id,
  p.name,
  p.avatar,
  json_agg(json_build_object(
    'card_id', c.card_id,
    'name', c.raw_payload->>'name',
    'icon', c.raw_payload->'iconUrls'->>'medium',
    'rarity', c.raw_payload->>'rarity'
  )) as restricted_cards
FROM season_card_restriction r
JOIN player p ON r.player_id = p.player_id
JOIN card c ON r.card_id = c.card_id
WHERE r.season_id = $1
GROUP BY p.player_id, p.name, p.avatar;
```

## UI Component Specifications

### 1. RestrictionCard Component

**Props**:
```typescript
{
  player: {
    player_id: string;
    name: string;
    zone: string;
    avatar?: string;
  };
  restrictedCards: Array<{
    card_id: string;
    name: string;
    icon: string;
    rarity: string;
  }>;
  onEdit: () => void;
  onDelete: () => void;
}
```

**Layout**: Card with player info, restricted card thumbnails, action buttons

### 2. CardGrid Component

**Props**:
```typescript
{
  cards: Card[];
  selectedCards: string[];  // card_ids
  rarityFilter: 'all' | 'champion' | 'legendary' | 'epic' | 'rare' | 'common';
  onCardToggle: (cardId: string) => void;
  onRarityChange: (rarity: string) => void;
}
```

**Features**:
- Grid layout (3 columns on mobile, 4-6 on desktop)
- Rarity filter pills
- Visual selection state
- Checkmark indicator on selected cards

### 3. PlayerMultiSelect Component

**Props**:
```typescript
{
  seasonId: string;
  selectedPlayers: Player[];
  onPlayerAdd: (player: Player) => void;
  onPlayerRemove: (playerId: string) => void;
}
```

**Features**:
- Searchable dropdown
- Player chips with avatars
- Remove button per chip
- Shows selected count

## Migration Strategy

### Phase 1: Database (Day 1)
1. Create migration file
2. Add `season_card_restriction` table
3. Add indexes
4. Add RLS policies
5. Test queries

### Phase 2: Backend Queries (Day 2)
1. Create Supabase service module
2. Implement CRUD functions
3. Add error handling
4. Write unit tests

### Phase 3: UI Components (Days 3-5)
1. Build CardGrid component
2. Build PlayerMultiSelect component
3. Build RestrictionCard component
4. Add to Storybook (optional)

### Phase 4: Pages (Days 6-8)
1. Create SeasonRestrictions page (list)
2. Create SeasonRestrictionEdit page (bulk)
3. Add navigation link
4. Wire up real-time subscriptions

### Phase 5: Testing & Polish (Days 9-11)
1. E2E tests with Playwright
2. Error handling refinement
3. Loading states
4. Empty states
5. Documentation

## Error Handling

### Common Errors

| Error | Cause | User Message | Recovery |
|-------|-------|--------------|----------|
| Duplicate restriction | Race condition | "Esta restricción ya existe" | Refresh list |
| Invalid card_id | Stale data | "Carta no encontrada" | Refresh cards |
| Invalid player_id | Player removed | "Jugador no encontrado" | Remove from selection |
| Permission denied | RLS failure | "No tienes permisos" | Redirect to login |
| Network timeout | Supabase down | "Error de conexión" | Retry button |

### Validation Rules

**Client-side**:
- At least 1 player selected
- At least 1 card selected
- Season is active (not closed)

**Server-side**:
- Player exists and participates in season
- Card exists in catalog
- Admin has permission
- Season exists

## Testing Strategy

### Unit Tests
- Card filtering logic
- Player selection state management
- Restriction grouping

### Integration Tests
- Supabase CRUD operations
- Real-time subscription handling
- RLS policy enforcement

### E2E Tests (Playwright)
1. Navigate to RES page
2. Click "Add Restriction"
3. Search and select player
4. Filter cards by rarity
5. Select 3 cards
6. Click "Apply"
7. Verify restrictions appear in list
8. Delete restriction
9. Verify removal

### Manual Testing Checklist
- [ ] Bulk restriction creation (3 players × 5 cards)
- [ ] Duplicate restriction handling
- [ ] Real-time updates across browser tabs
- [ ] Empty states (no restrictions)
- [ ] Mobile responsive layout
- [ ] Card filtering performance with all rarities
- [ ] Player search with 100+ participants
- [ ] Error states (network failure, permission denied)

## Open Technical Questions

1. **Card Images**: Use Supercell CDN directly or cache locally?
2. **Restriction Limits**: Should we cap max restrictions per player?
3. **Undo**: Do we need undo functionality for accidental deletes?
4. **Export**: Should admins be able to export restrictions as CSV?
5. **Import**: Should we support bulk import from file?
6. **Audit Log**: Track who created/deleted each restriction?

## Alternatives Considered

### Alternative 1: Single-page with modal
- **Rejected**: Modal doesn't provide enough space for card grid

### Alternative 2: Inline editing in list view
- **Rejected**: Too cluttered, confusing UX

### Alternative 3: Dropdown card selector
- **Rejected**: Less visual, harder to browse

### Alternative 4: Store restrictions in JSON field
- **Rejected**: Poor performance, no relational integrity

## Dependencies

- Existing `card` table with `raw_payload`
- Existing `player` table
- Existing `season` table
- `season_zone_team_player` for participant filtering
- Supabase real-time enabled
- Material Symbols font loaded

## Success Criteria

1. Admins can create bulk restrictions in < 30 seconds
2. Restriction list loads in < 1 second (100 restrictions)
3. Card grid renders all cards in < 500ms
4. Real-time updates appear within 2 seconds
5. Mobile layout is fully functional
6. Zero duplicate restrictions created
7. All E2E tests pass
