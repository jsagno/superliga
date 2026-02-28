# PlayerMultiSelect Component Documentation

## Overview

The `PlayerMultiSelect` component provides a sophisticated multi-select interface for choosing players from a season's participants. It automatically fetches players participating in the selected season, groups them by zone, and enables efficient searching and selection.

## Key Features

### 1. Data Integration
- Fetches all players from `season_zone_team_player` table for selected season
- Auto-groups players by zone (ZONE A, ZONE B, etc.)
- Deduplicates players appearing in multiple teams
- Sorts alphabetically within each zone

### 2. UI/UX Features
- **Combobox Interface**: Click trigger button to open/close dropdown
- **Zone Grouping**: Sticky zone headers showing player count per zone
- **Search**: Debounced 300ms search by player name or nick
- **Selected Chips**: Visual display of selected players as removable chips
- **Selection Counter**: Shows selected count vs max when limit is set
- **Loading State**: Shows "Loading players..." while fetching
- **Error Handling**: Displays error message with retry button
- **Empty States**: Contextual messages (no players, no results, etc.)

### 3. Selection Management
- Toggle individual players on/off
- Enforce optional max selection limit
- Clear all selected players at once
- Remove individual players from chips
- Visual indicator (opacity, checkmark) for selected players

### 4. Advanced Filtering
- **Zone Filter**: Show only players from specific zone (`zoneFilter` prop)
- **Exclude List**: Hide specific player IDs (`excludePlayerIds` prop)
- **Search**: Filter by name or nick with debouncing
- **Combined Filters**: All filters work together

### 5. Keyboard Navigation
- **Arrow Keys**: Navigate up/down through player list
- **Enter**: Select focused player
- **Escape**: Close dropdown
- **Tab**: Move focus between elements (browser default)
- **Space**: Open/close dropdown when trigger focused

### 6. Accessibility
- Full ARIA support: `aria-haspopup`, `aria-expanded`, `aria-selected`, `aria-label`
- Semantic HTML: `role="listbox"`, `role="option"`
- Keyboard-navigable entire interface
- Screen reader friendly: Descriptive labels for all interactive elements
- Focus management: Returns focus to trigger when closing

## Component Props

```jsx
<PlayerMultiSelect
  seasonId="season-uuid"                    // REQUIRED: Season ID to fetch players for
  selectedPlayers={[]}                      // REQUIRED: Array of {player_id, name}
  onPlayerAdd={(player) => {}}              // REQUIRED: Callback when player selected
  onPlayerRemove={(player) => {}}           // REQUIRED: Callback when player deselected
  onClearAll={() => {}}                     // REQUIRED: Callback when clear all clicked
  zoneFilter="zone-uuid"                    // OPTIONAL: Show only this zone
  excludePlayerIds={['p1', 'p2']}           // OPTIONAL: Hide these players
  maxSelection={5}                          // OPTIONAL: Max players that can be selected
/>
```

### Prop Details

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `seasonId` | string | Yes | UUID of season to load players from |
| `selectedPlayers` | Array | Yes | Array of `{player_id, name}` objects for selected players |
| `onPlayerAdd` | function | Yes | Called when player is selected with player object |
| `onPlayerRemove` | function | Yes | Called when player is deselected with player object |
| `onClearAll` | function | Yes | Called when "Clear All" button is clicked |
| `zoneFilter` | string | No | Zone UUID - if set, only show players from this zone |
| `excludePlayerIds` | Array | No | Array of player IDs to hide from selection |
| `maxSelection` | number | No | Maximum number of players that can be selected; shows alert if exceeded |

## Usage Examples

### Basic Usage

```jsx
import PlayerMultiSelect from './components/PlayerMultiSelect';

function SeasonAssignment() {
  const [selectedPlayers, setSelectedPlayers] = useState([]);

  return (
    <PlayerMultiSelect
      seasonId="season-123"
      selectedPlayers={selectedPlayers}
      onPlayerAdd={(player) => {
        setSelectedPlayers([...selectedPlayers, player]);
      }}
      onPlayerRemove={(player) => {
        setSelectedPlayers(selectedPlayers.filter(p => p.player_id !== player.player_id));
      }}
      onClearAll={() => {
        setSelectedPlayers([]);
      }}
    />
  );
}
```

### With Max Selection Limit

```jsx
// Select up to 5 players for a team
<PlayerMultiSelect
  seasonId="season-123"
  selectedPlayers={selectedPlayers}
  onPlayerAdd={handlePlayerAdd}
  onPlayerRemove={handlePlayerRemove}
  onClearAll={handleClearAll}
  maxSelection={5}
/>
```

### With Zone Filter

```jsx
// Only show players from ZONE A for specific assignments
<PlayerMultiSelect
  seasonId="season-123"
  selectedPlayers={selectedPlayers}
  onPlayerAdd={handlePlayerAdd}
  onPlayerRemove={handlePlayerRemove}
  onClearAll={handleClearAll}
  zoneFilter="zone-a-id"
/>
```

### With Exclusions

```jsx
// Exclude players already assigned to other roles
const alreadyAssigned = ['p1', 'p2', 'p3'];

<PlayerMultiSelect
  seasonId="season-123"
  selectedPlayers={selectedPlayers}
  onPlayerAdd={handlePlayerAdd}
  onPlayerRemove={handlePlayerRemove}
  onClearAll={handleClearAll}
  excludePlayerIds={alreadyAssigned}
/>
```

### In a Form Component

```jsx
function CreateRestrictionForm() {
  const [selectedPlayers, setSelectedPlayers] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      // Bulk create restrictions for selected players
      await restrictionsService.bulkCreateRestrictions(
        selectedPlayers.map(p => ({
          player_id: p.player_id,
          card_id: selectedCard.card_id,
          reason: 'Extreme mode restriction'
        })),
        seasonId
      );
      setSelectedPlayers([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">
          Select Players to Restrict
        </label>
        <PlayerMultiSelect
          seasonId={seasonId}
          selectedPlayers={selectedPlayers}
          onPlayerAdd={(p) => setSelectedPlayers([...selectedPlayers, p])}
          onPlayerRemove={(p) =>
            setSelectedPlayers(selectedPlayers.filter(x => x.player_id !== p.player_id))
          }
          onClearAll={() => setSelectedPlayers([])}
          maxSelection={50}
        />
      </div>
      <button type="submit" disabled={loading || selectedPlayers.length === 0}>
        {loading ? 'Creating restrictions...' : `Create Restrictions (${selectedPlayers.length})`}
      </button>
    </form>
  );
}
```

## Data Flow

```
Component Mount
    ↓
fetchPlayers (season_zone_team_player query)
    ↓
Group by zone & deduplicate
    ↓
Apply filters (zoneFilter, excludePlayerIds)
    ↓
Apply search (debounced 300ms)
    ↓
Display grouped results
    ↓
User selects player
    ↓
onPlayerAdd callback with {player_id, name, nick, zone_id, zone_name}
    ↓
Parent updates selectedPlayers state
    ↓
Component re-renders with updated selection checkmarks
```

## Styling

The component uses Tailwind CSS with dark mode support:

- **Trigger**: `bg-slate-900` with blue focus ring
- **Dropdown**: `bg-slate-900 border-slate-700` with shadow and max-height 96 with scrolling
- **Zone Headers**: Sticky position with `bg-slate-800` background
- **Player Items**: Hover effect with `bg-slate-800`, selected items show 60% opacity
- **Search Input**: `bg-slate-800` with blue focus state
- **Chips**: Blue theme `bg-blue-500/20 border-blue-500/30`
- **Checkmarks**: Blue (`text-blue-400`)
- **Text**: White for primary, slate-400/500 for secondary

### Custom Styling

To customize colors, override Tailwind classes in parent component or use CSS modules:

```jsx
// Override via parent className
<div className="[&_button]:hover:bg-custom-color">
  <PlayerMultiSelect {...props} />
</div>
```

## Performance Considerations

### 1. Debounced Search
- Search is debounced 300ms to avoid excessive filtering
- Users see real-time search results without lag
- Prevents re-renders on every keystroke

### 2. Deduplication
- Player data deduplicated on load
- Players appearing in multiple teams appear only once
- Reduces dropdown size and prevents confusion

### 3. Memoized Grouping
- `useMemo` caches grouped/filtered players
- Only recalculates when filters change
- Prevents unnecessary re-renders

### 4. Lazy Component Rendering
- Zone headers use sticky positioning
- Only visible items render (browser handles virtual scroll via CSS)
- Works well with max-height + overflow-y-auto

### 5. Scalability
- Tested with 100+ players per season
- Grouping by zone keeps dropdown manageable (typically 4-6 zones)
- Search reduces visible results to manageable size

## Accessibility Features

### Keyboard Support
| Key | Action |
|-----|--------|
| `Enter` / `Space` | Open/close dropdown when trigger focused |
| `↓` | Move focus to next player |
| `↑` | Move focus to previous player |
| `Enter` | Select focused player |
| `Escape` | Close dropdown, return focus to trigger |

### Screen Reader Support
- Button has `aria-haspopup="listbox"` and `aria-expanded`
- Each player item has `aria-selected` status
- Zone headers are semantic headers
- Remove buttons have descriptive labels: "Remove [PlayerName]"
- Search input has clear `aria-label`

### Visual Indicators
- Focus state: Highlighted background color
- Selection state: Checkmark + subtle opacity change
- Zone headers: Visual separation and player count

## Error Handling

### Network Errors
```jsx
// Component displays:
// "Error loading players: [error message]"
// With a Retry button

// After retry is clicked:
// loadPlayers() is called again

// Subsequent errors update error state and show new message
```

### Data Issues
- Missing player data: Shows "Unknown" for name
- Missing zone info: Shows "Unknown Zone"
- Null/undefined fields: Gracefully handled with fallbacks

### Selection Errors
- Exceeding max limit: `window.alert()` prevents selection, callback not triggered
- Should/could be replaced with in-component toast notification

## Real-time Updates

The component fetches data once on mount. To enable real-time updates:

```jsx
// In parent component, subscribe to changes:
useEffect(() => {
  const subscription = supabase
    .channel(`season:${seasonId}`)
    .on('postgres_changes', 
      { event: '*', schema: 'public', table: 'season_zone_team_player' },
      (payload) => {
        // Trigger reload when players change
        loadPlayers();
      }
    )
    .subscribe();

  return () => subscription.unsubscribe();
}, [seasonId]);
```

## Testing

Component has comprehensive test coverage:
- 60+ test cases
- Data fetching and grouping
- Selection and filtering
- Search functionality
- Keyboard navigation
- Accessibility features
- Error handling
- Empty states

Run tests:
```bash
npm run test -- PlayerMultiSelect.test.jsx
```

## Troubleshooting

### "No players available" when season has participants

**Issue**: Component shows no players even though season has participants

**Solutions**:
1. Verify `seasonId` is correct UUID
2. Check that `season_zone_team_player` records exist for this season
3. Ensure participants have valid references to `player`, `zone`, `team` tables
4. Check browser console for query errors
5. Click "Retry" button to refetch

### Search not finding players

**Issue**: Player appears in dropdown but doesn't show up in search results

**Solutions**:
1. Search is case-insensitive but requires partial or exact match
2. Search looks in both `name` and `nick` fields
3. Try searching without special characters (@, #, etc.)
4. Verify player name/nick in database

### Selection works but callbacks not firing

**Issue**: Clicked player but `onPlayerAdd` never called

**Solutions**:
1. Check that `onPlayerAdd` is defined and passed as prop
2. Verify `maxSelection` limit isn't blocking addition
3. Check console for `window.alert()` message about max selection
4. Components don't auto-close after selection - that's parent responsibility

### Zone header shows but no players underneath

**Issue**: Zone header (e.g., "ZONE A (0)") displays but no players

**Solutions**:
1. Zone header shows even if filtered to 0 players
2. Check `zoneFilter` and `excludePlayerIds` props
3. Try clearing search query
4. Verify players exist in that zone in database

## Future Enhancements

1. **Virtual Scrolling**: For 1000+ player seasons, use `react-window`
2. **Bulk Operations**: Select/deselect all players in a zone
3. **Favorites**: Remember recently selected players
4. **Toast Notifications**: Replace alert() with toast for max selection
5. **Custom Rendering**: Allow parent to customize player item display
6. **Async Search**: Search from parent component instead of client filtering
7. **Player Avatars**: Display clan badges or player avatars if available
8. **Sort Options**: Sort by name, nick, or join date

## Related Components

- **CardGrid**: Similar pattern for multi-select cards
  - Both use debounced search
  - Both display selected items as chips
  - Both support keyboard navigation
  
- **restrictionsService**: Integrates with this component
  - `bulkCreateRestrictions()` takes array of player_id/card_id pairs

## Dependencies

- `React 18+`: Hooks (useState, useEffect, useCallback, useMemo, useRef)
- `Supabase JS Client`: Query player data
- `Tailwind CSS 3+`: Styling and dark mode
- External: None

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

All modern browsers with ES2020+ support.
