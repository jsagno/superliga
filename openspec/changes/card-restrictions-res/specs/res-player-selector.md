# Capability: RES Player Selector

## Overview

The Player Selector enables administrators to choose one or more players from the current season's participants to apply card restrictions. Players are displayed as searchable chips with avatars, supporting multi-select with visual feedback.

## User Stories

### Story 1: View Available Players

**As an** admin  
**I want to** see all eligible players for the current season  
**So that** I can select whom to restrict

**Acceptance Criteria**:
- Dropdown shows all players participating in the season
- Players are grouped by zone
- Each player displays: avatar, name, zone
- Players are ordered alphabetically within zones
- Loading spinner shown while fetching

### Story 2: Search for Players

**As an** admin  
**I want to** search for players by name  
**So that** I can quickly find specific individuals

**Acceptance Criteria**:
- Search input at top of dropdown
- Results update as user types (debounced 300ms)
- Case-insensitive partial matching on player name
- "X players found" counter displayed
- Empty state message if no matches

### Story 3: Select Multiple Players

**As an** admin  
**I want to** select multiple players at once  
**So that** I can apply restrictions to a group

**Acceptance Criteria**:
- Clicking player adds them to selection
- Selected players appear as chips below search
- Chips show avatar + name
- Selection counter shows "X players selected"
- Dropdown remains open after selection (allows multi-add)

### Story 4: Remove Selected Players

**As an** admin  
**I want to** remove players from selection  
**So that** I can correct mistakes

**Acceptance Criteria**:
- Each chip has remove button (×)
- Clicking (×) removes player from selection
- Removed player reappears in dropdown
- "Clear All" button available when 2+ selected
- Selection counter updates immediately

### Story 5: Visual Player Status

**As an** admin  
**I want to** see which players are already selected  
**So that** I don't select duplicates

**Acceptance Criteria**:
- Selected players have checkmark in dropdown
- Selected players are grayed out or moved to bottom
- Clicking selected player again removes them
- Visual distinction between selected/unselected

## Technical Specification

### Component API

```typescript
interface PlayerMultiSelectProps {
  seasonId: string;
  selectedPlayers: Player[];
  onPlayerAdd: (player: Player) => void;
  onPlayerRemove: (playerId: string) => void;
  zoneFilter?: string;           // Optional: pre-filter by zone
  excludePlayerIds?: string[];   // Optional: hide specific players
  maxSelection?: number;         // Optional limit (0 = unlimited)
}

interface Player {
  player_id: string;
  name: string;
  zone: string;
  avatar?: string;
}
```

### Component Structure

```jsx
<PlayerMultiSelect>
  {/* Selected Players Chips */}
  <SelectedPlayersChips>
    {selectedPlayers.map(player => (
      <PlayerChip
        key={player.player_id}
        player={player}
        onRemove={() => onPlayerRemove(player.player_id)}
      />
    ))}
    {selectedPlayers.length > 1 && (
      <ClearAllButton onClick={clearAll} />
    )}
  </SelectedPlayersChips>
  
  {/* Search Dropdown */}
  <Dropdown open={isOpen} onToggle={setIsOpen}>
    <DropdownTrigger>
      <SearchInput 
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search players..."
      />
    </DropdownTrigger>
    
    <DropdownContent>
      {loading ? (
        <LoadingSpinner />
      ) : (
        <PlayerList>
          {groupedPlayers.map(({ zone, players }) => (
            <ZoneGroup key={zone}>
              <ZoneHeader>{zone}</ZoneHeader>
              {players.map(player => (
                <PlayerItem
                  key={player.player_id}
                  player={player}
                  isSelected={isSelected(player.player_id)}
                  onClick={() => handlePlayerToggle(player)}
                />
              ))}
            </ZoneGroup>
          ))}
        </PlayerList>
      )}
      
      {filteredPlayers.length === 0 && (
        <EmptyState message="No players found" />
      )}
    </DropdownContent>
  </Dropdown>
</PlayerMultiSelect>
```

### Data Fetching

```javascript
const [players, setPlayers] = useState([]);
const [loading, setLoading] = useState(false);

useEffect(() => {
  async function fetchPlayers() {
    setLoading(true);
    
    const { data, error } = await supabase
      .from('season_zone_team_player')
      .select(`
        player:player_id (
          player_id,
          name,
          avatar_url
        ),
        zone:zone_id (
          zone_name
        )
      `)
      .eq('season_id', seasonId)
      .order('player.name', { ascending: true });
    
    if (error) {
      toast.error('Error al cargar jugadores');
      setLoading(false);
      return;
    }
    
    // Transform data
    const parsedPlayers = data.map(item => ({
      player_id: item.player.player_id,
      name: item.player.name,
      avatar: item.player.avatar_url,
      zone: item.zone.zone_name,
    }));
    
    setPlayers(parsedPlayers);
    setLoading(false);
  }
  
  fetchPlayers();
}, [seasonId]);
```

### Filtering & Grouping

```javascript
const filteredPlayers = useMemo(() => {
  let result = players;
  
  // Exclude specific players
  if (excludePlayerIds?.length > 0) {
    result = result.filter(p => !excludePlayerIds.includes(p.player_id));
  }
  
  // Apply zone filter
  if (zoneFilter) {
    result = result.filter(p => p.zone === zoneFilter);
  }
  
  // Apply search query
  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    result = result.filter(p => 
      p.name.toLowerCase().includes(query)
    );
  }
  
  return result;
}, [players, excludePlayerIds, zoneFilter, searchQuery]);

const groupedPlayers = useMemo(() => {
  const groups = filteredPlayers.reduce((acc, player) => {
    if (!acc[player.zone]) {
      acc[player.zone] = [];
    }
    acc[player.zone].push(player);
    return acc;
  }, {});
  
  // Convert to array and sort by zone name
  return Object.entries(groups)
    .map(([zone, players]) => ({ zone, players }))
    .sort((a, b) => a.zone.localeCompare(b.zone));
}, [filteredPlayers]);
```

### Selection Logic

```javascript
function handlePlayerToggle(player) {
  const isCurrentlySelected = selectedPlayers.some(
    p => p.player_id === player.player_id
  );
  
  if (isCurrentlySelected) {
    // Remove from selection
    onPlayerRemove(player.player_id);
  } else {
    // Add to selection (check max limit)
    if (maxSelection > 0 && selectedPlayers.length >= maxSelection) {
      toast.warning(`Máximo ${maxSelection} jugadores permitidos`);
      return;
    }
    onPlayerAdd(player);
  }
}

function clearAll() {
  selectedPlayers.forEach(player => {
    onPlayerRemove(player.player_id);
  });
}

function isSelected(playerId) {
  return selectedPlayers.some(p => p.player_id === playerId);
}
```

## UI Design

### Player Chip

```jsx
<div className="inline-flex items-center gap-2 bg-gray-700 rounded-full pr-3 pl-1 py-1 mr-2 mb-2">
  {/* Avatar */}
  {player.avatar ? (
    <img 
      src={player.avatar}
      alt={player.name}
      className="w-8 h-8 rounded-full"
    />
  ) : (
    <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center">
      <span className="material-symbols-outlined text-sm">
        person
      </span>
    </div>
  )}
  
  {/* Name */}
  <span className="text-sm font-medium">{player.name}</span>
  
  {/* Remove Button */}
  <button
    onClick={onRemove}
    className="w-5 h-5 rounded-full bg-gray-600 hover:bg-gray-500 flex items-center justify-center transition"
  >
    <span className="material-symbols-outlined text-xs">
      close
    </span>
  </button>
</div>
```

### Player Item in Dropdown

```jsx
<button
  onClick={onClick}
  className={`
    w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-700 transition
    ${isSelected ? 'bg-gray-800 opacity-75' : ''}
  `}
>
  {/* Avatar */}
  <img 
    src={player.avatar || '/default-avatar.png'}
    alt={player.name}
    className="w-10 h-10 rounded-full"
  />
  
  {/* Player Info */}
  <div className="flex-1 text-left">
    <div className="font-medium">{player.name}</div>
    <div className="text-sm text-gray-400">{player.zone}</div>
  </div>
  
  {/* Selection Indicator */}
  {isSelected && (
    <span className="material-symbols-outlined text-blue-500">
      check_circle
    </span>
  )}
</button>
```

### Zone Group Header

```jsx
<div className="sticky top-0 bg-gray-900 px-4 py-2 font-semibold text-sm text-gray-400 border-b border-gray-700">
  {zone}
  <span className="ml-2 text-xs">
    ({players.length})
  </span>
</div>
```

### Layout Example

```
┌────────────────────────────────────────────────────┐
│  Selected Players (3):                             │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ [Clear All]  │
│  │ 👤 John │ │ 👤 Jane │ │ 👤 Bob  │              │
│  │    ×    │ │    ×    │ │    ×   │              │
│  └─────────┘ └─────────┘ └─────────┘              │
├────────────────────────────────────────────────────┤
│  🔍 Search players...                    [▾]       │
├────────────────────────────────────────────────────┤
│  ZONE A (4)                                        │
│  ┌────────────────────────────────────┐            │
│  │ 👤 Alice Smith        Zone A    ✓  │            │
│  └────────────────────────────────────┘            │
│  ┌────────────────────────────────────┐            │
│  │ 👤 Bob Wilson         Zone A       │            │
│  └────────────────────────────────────┘            │
│  ... (more players)                                │
│                                                     │
│  ZONE B (5)                                        │
│  ... (zone B players)                              │
└────────────────────────────────────────────────────┘
```

### Empty State

```jsx
{filteredPlayers.length === 0 && (
  <div className="text-center py-8 px-4">
    <span className="material-symbols-outlined text-4xl text-gray-600">
      person_off
    </span>
    <p className="mt-2 text-gray-400">
      {searchQuery 
        ? `No se encontraron jugadores con "${searchQuery}"`
        : 'No hay jugadores disponibles'}
    </p>
  </div>
)}
```

## Performance Optimization

### Virtualized List

For seasons with 100+ players:

```javascript
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={400}
  itemCount={filteredPlayers.length}
  itemSize={60}
  width="100%"
>
  {({ index, style }) => {
    const player = filteredPlayers[index];
    return (
      <div style={style}>
        <PlayerItem player={player} />
      </div>
    );
  }}
</FixedSizeList>
```

### Debounced Search

```javascript
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

const debouncedSearchQuery = useDebouncedValue(searchQuery, 300);

// Use debouncedSearchQuery in filter logic
```

### Memoized Selection Check

```javascript
const selectedPlayerIds = useMemo(() => {
  return new Set(selectedPlayers.map(p => p.player_id));
}, [selectedPlayers]);

function isSelected(playerId) {
  return selectedPlayerIds.has(playerId);
}
```

## Accessibility

- **Keyboard Navigation**:
  - Tab to focus search input
  - Arrow keys to navigate dropdown
  - Enter/Space to select player
  - Escape to close dropdown

- **ARIA Attributes**:
  ```jsx
  <div
    role="combobox"
    aria-expanded={isOpen}
    aria-controls="player-listbox"
    aria-haspopup="listbox"
  >
    <input
      type="text"
      role="searchbox"
      aria-label="Search players"
      aria-autocomplete="list"
    />
  </div>
  
  <ul
    id="player-listbox"
    role="listbox"
    aria-label="Available players"
  >
    {players.map(player => (
      <li
        key={player.player_id}
        role="option"
        aria-selected={isSelected(player.player_id)}
      >
        {player.name}
      </li>
    ))}
  </ul>
  ```

- **Screen Reader Announcements**:
  - "John Doe added to selection, 3 players selected"
  - "Jane Smith removed from selection, 2 players selected"
  - "Showing 15 players in Zone A"

## Error Handling

| Error | User Message | Recovery |
|-------|--------------|----------|
| Failed to load players | "Error al cargar jugadores" | Retry button |
| Player not found | "Jugador no encontrado" | Refresh list |
| Network timeout | "Error de conexión" | Auto-retry 3 times |
| Invalid season | "Temporada inválida" | Redirect to seasons |

## BDD Scenarios

### Scenario: Select Multiple Players

```gherkin
Given I am viewing the player selector
And no players are selected
When I click on "John Doe"
And I click on "Jane Smith"
And I click on "Bob Wilson"
Then 3 player chips are displayed
And the counter shows "3 players selected"
And each chip has an avatar and name
And each chip has a remove button
```

### Scenario: Search for Player

```gherkin
Given I am viewing all 50 players
When I type "john" in the search box
Then I only see players whose name contains "john"
And the results show "3 players found"
When I clear the search
Then all 50 players are visible again
```

### Scenario: Remove from Selection

```gherkin
Given I have selected "John Doe" and "Jane Smith"
When I click the (×) button on John's chip
Then John's chip is removed
And the counter shows "1 player selected"
And John reappears in the dropdown
And John is no longer marked as selected
```

### Scenario: Clear All Selections

```gherkin
Given I have selected 5 players
When I click "Clear All"
Then all player chips are removed
And the counter shows "0 players selected"
And all players reappear in dropdown
```

### Scenario: Maximum Selection Limit

```gherkin
Given maxSelection is set to 10
And I have selected 10 players
When I attempt to select an 11th player
Then I see a warning "Maximum 10 players allowed"
And the 11th player is not added to selection
```

### Scenario: Zone Grouping

```gherkin
Given the season has 4 zones
And each zone has 5 players
When I open the dropdown
Then I see 4 zone headers
And each header shows the zone name and player count
And players are listed under their zone
And zones are alphabetically ordered
```

## Testing Checklist

### Unit Tests
- [ ] Fetch players for season
- [ ] Filter by search query
- [ ] Filter by zone
- [ ] Group players by zone
- [ ] Handle player selection/deselection
- [ ] Enforce max selection limit
- [ ] Clear all selections

### Integration Tests
- [ ] Query Supabase successfully
- [ ] Handle missing player data
- [ ] Handle missing zone data
- [ ] Debounce search input

### E2E Tests
- [ ] Open player selector dropdown
- [ ] Search for player by name
- [ ] Select multiple players
- [ ] Remove player chip
- [ ] Clear all selections
- [ ] View zone grouping
- [ ] Keyboard navigation

## Dependencies

- `season_zone_team_player` table (links players to zones)
- `player` table (player profiles)
- `zone` table (zone names)
- Material Symbols font (person, close, check_circle icons)
- Optional: react-window for virtualization
- Optional: @headlessui/react for dropdown behavior

## Future Enhancements

- Filter by team (not just zone)
- Show player stats in dropdown (win rate, battles played)
- "Select All in Zone" quick action
- Recently selected players quick access
- Player status indicators (active/inactive)
- Bulk paste player names from clipboard
- Export selected players as list
- Save player groups as templates
- Player avatars from Clash Royale API
