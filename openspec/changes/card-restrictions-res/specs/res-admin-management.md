# Capability: RES Admin Management

## Overview

The RES Admin Management capability provides administrators with a complete interface to view, create, edit, and delete card restrictions for players within a season. This is the primary entry point for the RES system, accessible from the admin navigation menu.

## User Stories

### Story 1: View All Restrictions

**As an** admin  
**I want to** see all card restrictions for the current season  
**So that** I can understand which players have deck limitations

**Acceptance Criteria**:
- List displays all players with restrictions grouped by player
- Each player card shows their name, zone, and avatar
- Restricted cards are displayed as thumbnails with card names
- Cards are grouped by rarity (champions first, common last)
- Empty state message shown when no restrictions exist
- Loading state displayed while fetching data

### Story 2: Navigate to Create Restrictions

**As an** admin  
**I want to** easily add new restrictions  
**So that** I can enforce competitive balance rules

**Acceptance Criteria**:
- "Add Restriction" button visible at top of page
- Button navigates to bulk editor page
- Button is disabled if season is closed/archived
- Tooltip explains why button is disabled (if applicable)

### Story 3: View Restriction Details

**As an** admin  
**I want to** see detailed information about each restriction  
**So that** I can understand why it was created

**Acceptance Criteria**:
- Clicking player card expands to show details
- Details include: creation date, created by admin, reason
- Details are collapsed by default to save space
- Smooth animation on expand/collapse

### Story 4: Delete Individual Restriction

**As an** admin  
**I want to** remove a single card restriction from a player  
**So that** I can correct errors or update rules

**Acceptance Criteria**:
- Each restricted card has a remove icon (×)
- Clicking remove shows confirmation dialog
- Dialog states: "Remove [Card Name] restriction from [Player Name]?"
- Successful deletion removes card from UI immediately
- Error message shown if deletion fails
- Undo option available for 5 seconds after deletion

### Story 5: Delete All Player Restrictions

**As an** admin  
**I want to** remove all restrictions from a player  
**So that** I can quickly clear outdated rules

**Acceptance Criteria**:
- "Clear All" button on each player card
- Confirmation dialog states: "Remove ALL restrictions from [Player Name]?"
- Shows count of restrictions to be deleted
- Successful deletion removes entire player card from list
- Error message if any deletion fails
- Partial success handled gracefully (some deleted, some failed)

### Story 6: Filter/Search Restrictions

**As an** admin  
**I want to** search for specific players or cards  
**So that** I can quickly find relevant restrictions

**Acceptance Criteria**:
- Search bar at top of page
- Searches player names (case-insensitive)
- Searches card names (case-insensitive)
- Results update in real-time as user types
- "X results found" counter displayed
- Clear search button (×) visible when text entered

### Story 7: Real-time Updates

**As an** admin  
**I want to** see restriction changes made by other admins immediately  
**So that** I have the latest information

**Acceptance Criteria**:
- New restrictions appear without page refresh
- Deleted restrictions disappear immediately
- Updated restrictions reflect changes
- Visual indicator shows when data is updating
- No flickering or jarring UI jumps

## Technical Specification

### Route

**Path**: `/admin/seasons/:seasonId/restrictions`

**Parameters**:
- `seasonId` (UUID): Current season identifier

**Authentication**: Requires admin session via `<ProtectedRoute>`

### Component Structure

```jsx
<SeasonRestrictions>
  <PageHeader>
    <Title>Restricciones de Cartas (RES)</Title>
    <SearchBar />
    <AddButton />
  </PageHeader>
  
  <FilterBar>
    <ZoneFilter />
    <RarityFilter />
  </FilterBar>
  
  <RestrictionsList>
    {players.map(player => (
      <RestrictionCard
        player={player}
        restrictedCards={player.restrictions}
        onDeleteCard={handleDeleteCard}
        onDeleteAll={handleDeleteAll}
      />
    ))}
  </RestrictionsList>
  
  <EmptyState />
</SeasonRestrictions>
```

### Data Requirements

**Query**: Fetch all restrictions for season with player and card details

```javascript
const { data: restrictions, error } = await supabase
  .from('season_card_restriction')
  .select(`
    restriction_id,
    reason,
    created_at,
    created_by,
    player:player_id (
      player_id,
      name,
      zone:season_zone_team_player!inner (
        zone:zone_id (
          zone_name
        )
      )
    ),
    card:card_id (
      card_id,
      raw_payload
    )
  `)
  .eq('season_id', seasonId)
  .order('player.name', { ascending: true });
```

**Data Transformation**:
```javascript
// Group restrictions by player
const groupedRestrictions = restrictions.reduce((acc, restriction) => {
  const playerId = restriction.player.player_id;
  
  if (!acc[playerId]) {
    acc[playerId] = {
      player: restriction.player,
      restrictions: []
    };
  }
  
  acc[playerId].restrictions.push({
    restriction_id: restriction.restriction_id,
    card_id: restriction.card.card_id,
    card_name: restriction.card.raw_payload.name,
    card_icon: restriction.card.raw_payload.iconUrls.medium,
    card_rarity: restriction.card.raw_payload.rarity,
    reason: restriction.reason,
    created_at: restriction.created_at
  });
  
  return acc;
}, {});

// Sort cards by rarity
const rarityOrder = { champion: 0, legendary: 1, epic: 2, rare: 3, common: 4 };
Object.values(groupedRestrictions).forEach(({ restrictions }) => {
  restrictions.sort((a, b) => 
    rarityOrder[a.card_rarity] - rarityOrder[b.card_rarity]
  );
});
```

### State Management

```javascript
const [restrictions, setRestrictions] = useState([]);
const [loading, setLoading] = useState(true);
const [searchQuery, setSearchQuery] = useState('');
const [zoneFilter, setZoneFilter] = useState('all');
const [undoQueue, setUndoQueue] = useState([]);
```

### Real-time Subscription

```javascript
useEffect(() => {
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
        if (payload.eventType === 'INSERT') {
          handleNewRestriction(payload.new);
        } else if (payload.eventType === 'DELETE') {
          handleDeletedRestriction(payload.old);
        }
      }
    )
    .subscribe();

  return () => {
    subscription.unsubscribe();
  };
}, [seasonId]);
```

### Delete Operations

**Delete Single Card**:
```javascript
async function handleDeleteCard(restrictionId) {
  const { error } = await supabase
    .from('season_card_restriction')
    .delete()
    .eq('restriction_id', restrictionId);
  
  if (error) {
    toast.error('Error al eliminar restricción');
    return;
  }
  
  // Add to undo queue
  setUndoQueue(prev => [...prev, { restrictionId, timestamp: Date.now() }]);
  toast.success('Restricción eliminada', { action: 'Deshacer' });
  
  // Clear from undo queue after 5 seconds
  setTimeout(() => {
    setUndoQueue(prev => prev.filter(u => u.restrictionId !== restrictionId));
  }, 5000);
}
```

**Delete All Player Restrictions**:
```javascript
async function handleDeleteAll(playerId) {
  const confirmed = await confirm(
    `¿Eliminar TODAS las restricciones de ${playerName}?`,
    `Se eliminarán ${count} restricciones.`
  );
  
  if (!confirmed) return;
  
  const { error } = await supabase
    .from('season_card_restriction')
    .delete()
    .eq('season_id', seasonId)
    .eq('player_id', playerId);
  
  if (error) {
    toast.error('Error al eliminar restricciones');
    return;
  }
  
  toast.success(`${count} restricciones eliminadas`);
}
```

### Filtering Logic

```javascript
const filteredRestrictions = useMemo(() => {
  return Object.values(groupedRestrictions).filter(({ player, restrictions }) => {
    // Zone filter
    if (zoneFilter !== 'all' && player.zone.zone_name !== zoneFilter) {
      return false;
    }
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const playerMatch = player.name.toLowerCase().includes(query);
      const cardMatch = restrictions.some(r => 
        r.card_name.toLowerCase().includes(query)
      );
      return playerMatch || cardMatch;
    }
    
    return true;
  });
}, [groupedRestrictions, zoneFilter, searchQuery]);
```

## UI Design

### Layout

```
┌─────────────────────────────────────────────────────┐
│  Restricciones de Cartas (RES)        [+ Add]       │
│  ┌───────────────────────────────────────────────┐  │
│  │ 🔍 Search players or cards...           [×]   │  │
│  └───────────────────────────────────────────────┘  │
│  [All Zones ▾] [All Rarities ▾]                     │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ┌─────────────────────────────────────────────┐   │
│  │ 👤 Player Name         Zone A   [Clear All] │   │
│  │                                              │   │
│  │  [🃏 Card 1 ×] [🃏 Card 2 ×] [🃏 Card 3 ×]  │   │
│  └─────────────────────────────────────────────┘   │
│                                                      │
│  ┌─────────────────────────────────────────────┐   │
│  │ 👤 Player Name 2       Zone B   [Clear All] │   │
│  │                                              │   │
│  │  [🃏 Card 4 ×] [🃏 Card 5 ×]                │   │
│  └─────────────────────────────────────────────┘   │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### RestrictionCard Component

```jsx
<div className="bg-gray-800 rounded-lg p-4 mb-3">
  {/* Header */}
  <div className="flex items-center justify-between mb-3">
    <div className="flex items-center gap-3">
      <img 
        src={player.avatar} 
        className="w-12 h-12 rounded-full"
        alt={player.name}
      />
      <div>
        <h3 className="font-semibold">{player.name}</h3>
        <span className="text-sm text-gray-400">{player.zone}</span>
      </div>
    </div>
    <button 
      onClick={onDeleteAll}
      className="text-red-400 hover:text-red-300"
    >
      Clear All
    </button>
  </div>
  
  {/* Restricted Cards */}
  <div className="flex flex-wrap gap-2">
    {restrictedCards.map(card => (
      <div 
        key={card.card_id}
        className="relative group"
      >
        <img 
          src={card.card_icon}
          className={`w-16 h-20 rounded ${rarityBorder[card.card_rarity]}`}
          alt={card.card_name}
        />
        <button
          onClick={() => onDeleteCard(card.restriction_id)}
          className="absolute -top-1 -right-1 bg-red-500 rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
        >
          ×
        </button>
        <span className="text-xs block text-center mt-1">
          {card.card_name}
        </span>
      </div>
    ))}
  </div>
</div>
```

### Empty State

```jsx
{filteredRestrictions.length === 0 && (
  <div className="text-center py-12">
    <span className="material-symbols-outlined text-6xl text-gray-600">
      block
    </span>
    <h3 className="text-xl font-semibold mt-4 mb-2">
      No hay restricciones
    </h3>
    <p className="text-gray-400 mb-6">
      {searchQuery 
        ? 'No se encontraron resultados para tu búsqueda'
        : 'Agrega restricciones de cartas para jugadores específicos'}
    </p>
    {!searchQuery && (
      <button
        onClick={() => navigate('edit')}
        className="btn-primary"
      >
        + Add Restriction
      </button>
    )}
  </div>
)}
```

## Error Handling

| Error | User Message | Recovery Action |
|-------|--------------|-----------------|
| Failed to load restrictions | "Error al cargar restricciones" | Retry button |
| Failed to delete | "No se pudo eliminar la restricción" | Keep in UI, show retry |
| Permission denied | "No tienes permisos para gestionar restricciones" | Redirect to dashboard |
| Season not found | "Temporada no encontrada" | Redirect to seasons list |
| Network timeout | "Error de conexión. Intenta de nuevo." | Auto-retry 3 times |

## Performance Requirements

- Initial load: < 1 second for 100 restrictions
- Search filter: < 100ms response time
- Real-time update: < 2 seconds to appear
- Smooth scrolling with 200+ restriction cards
- No layout shift during updates

## Accessibility

- Keyboard navigation for all actions
- ARIA labels on interactive elements
- Focus trap on confirmation dialogs
- Screen reader announcements for updates
- High contrast mode support

## BDD Scenarios

### Scenario: View Restrictions List

```gherkin
Given I am logged in as admin
And I navigate to "/admin/seasons/{seasonId}/restrictions"
When the page loads
Then I should see a list of all restricted players
And each player card shows their name and zone
And restricted cards are displayed as thumbnails
And cards are ordered by rarity (champion to common)
```

### Scenario: Delete Single Restriction

```gherkin
Given I am viewing the restrictions list
And player "John Doe" has "Archer Queen" restricted
When I hover over the "Archer Queen" card
And I click the remove (×) button
And I confirm the deletion
Then "Archer Queen" is removed from John's restrictions
And I see a success toast "Restricción eliminada"
And an undo button is available for 5 seconds
```

### Scenario: Delete All Player Restrictions

```gherkin
Given I am viewing the restrictions list
And player "Jane Smith" has 5 restricted cards
When I click "Clear All" on Jane's card
And I see a confirmation "Remove ALL restrictions from Jane Smith?"
And the dialog shows "5 restricciones will be deleted"
And I confirm
Then Jane's card is removed from the list
And I see "5 restricciones eliminadas"
```

### Scenario: Search for Player

```gherkin
Given I am viewing the restrictions list
And there are 20 players with restrictions
When I type "John" in the search bar
Then I only see players whose name contains "John"
And the counter shows "3 results found"
When I clear the search
Then all 20 players are visible again
```

### Scenario: Real-time Update

```gherkin
Given I am viewing the restrictions list
And another admin is using the system
When the other admin adds a restriction for "Bob Wilson"
Then Bob's card appears in my list automatically
And I see a subtle update indicator
And the card has the new restriction
```

## Testing Checklist

### Unit Tests
- [ ] Group restrictions by player correctly
- [ ] Sort cards by rarity
- [ ] Filter by search query
- [ ] Filter by zone
- [ ] Handle empty data gracefully

### Integration Tests
- [ ] Fetch restrictions from Supabase
- [ ] Subscribe to real-time updates
- [ ] Delete single restriction
- [ ] Delete all player restrictions
- [ ] Handle Supabase errors

### E2E Tests
- [ ] Navigate to restrictions page
- [ ] View full list of restrictions
- [ ] Search for player
- [ ] Delete single card restriction
- [ ] Delete all player restrictions
- [ ] Real-time updates across tabs
- [ ] Empty state displays correctly

## Dependencies

- `packages/liga-admin/src/components/RestrictionCard.jsx` (new)
- `packages/liga-admin/src/components/AdminLayout.jsx` (add navigation link)
- `supabase/migrations/*_add_season_card_restriction.sql` (new)
- Existing: `ProtectedRoute`, `useAuth`, `supabase` client

## Future Enhancements

- Export restrictions as CSV/PDF
- Import restrictions from file
- Bulk edit (change reason/notes)
- Restriction history timeline
- Audit log (who created/deleted when)
- Notification to affected players
- Integration with deck validation in battles
