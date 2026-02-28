# RestrictionCard Component Documentation

## Overview

The `RestrictionCard` component displays all of a player's card restrictions for the current season. It shows restricted cards grouped by rarity with visual indicators, hover-based delete buttons, and a confirmation-protected "Clear All" action.

## Key Features

### 1. Player Information Display
- **Player Avatar**: Color-coded circle with first letter initial
- **Player Name**: Display with bold formatting
- **Zone Name**: Show player's zone assignment
- **Nick**: Player's in-game nickname (if available)
- **Card Count**: Badge showing total restricted cards

### 2. Card Organization
- **Rarity Grouping**: Automatically groups cards into sections (Champion, Legendary, Epic, Rare, Common)
- **Rarity Emojis**: Visual indicator (👑 Champion, ⭐ Legendary, 💜 Epic, 💙 Rare, ⚪ Common)
- **Alphabetic Sort**: Cards sorted alphabetically within each rarity group
- **Card Count Per Rarity**: Badge shows count of cards in each group
- **Empty Rarity Hiding**: Rarity groups with zero cards are hidden

### 3. Card Display
- **Thumbnail View**: Compact 16h×24 display of each card
- **Rarity Border Colors**:
  - Champion: Yellow (`border-yellow-500`)
  - Legendary: Orange (`border-orange-500`)
  - Epic: Purple (`border-purple-500`)
  - Rare: Blue (`border-blue-500`)
  - Common: Gray (`border-slate-500`)
- **Hover Effects**: Cards scale and brighten on hover
- **Card Icon**: Placeholder icon (🛡️) for visual consistency

### 4. Delete Functionality
- **Individual Card Delete**: Hover reveals delete button (×) on each card
- **Delete Confirmation**: Direct delete without confirmation for individual cards
- **Clear All Action**: Button to remove all restrictions for player
- **Safe Clear All**: Confirmation dialog with "Yes"/"Cancel" options (unless `onApprovedDelete` is true)
- **Keyboard Delete**: Delete or Backspace key on focused card triggers deletion

### 5. Visual Design
- **Card Groups**: Sections separated with rarity emoji and count
- **Footer**: Card count summary and action buttons
- **Tooltips**: Show card name on hover
- **Transitions**: Smooth hover effects and scale animations
- **Dark Theme**: Tailwind dark mode with slate/blue color palette

### 6. Accessibility
- Full ARIA support: `aria-label` for all interactive elements
- Keyboard navigation: Tab through cards, Delete key to remove
- Semantic roles: `role="img"` for card containers
- Clear labels: Every button and card has descriptive text
- Focus management: Cards are focusable with `tabIndex={0}`

## Component Props

```jsx
<RestrictionCard
  player={{
    player_id: "p1",
    name: "Alice",
    nick: "@Alice",
    zone_name: "ZONE A"
  }}
  restrictedCards={[
    {
      restriction_id: "r1",
      card_id: 1,
      card_name: "P.E.K.K.A",
      rarity: "Legendary",
      created_at: "2025-02-27T10:00:00Z"
    }
  ]}
  onDeleteCard={(restrictionId) => {}}
  onDeleteAll={(playerId) => {}}
  onApprovedDelete={false}
/>
```

### Prop Details

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `player` | object | Yes | Player info: `{player_id, name, nick, zone_name}` |
| `restrictedCards` | array | Yes | Array of restricted card objects |
| `onDeleteCard` | function | Yes | Called with `restrictionId` when card delete clicked |
| `onDeleteAll` | function | Yes | Called with `playerId` when clear all confirmed |
| `onApprovedDelete` | boolean | No | If true, skip confirmation for Clear All (default: false) |

### Restricted Card Object Structure

```js
{
  restriction_id: "uuid",      // Unique identifier for this restriction
  card_id: 1,                   // Clash Royale card ID (BIGINT)
  card_name: "P.E.K.K.A",       // Card display name
  rarity: "Legendary",          // Rarity level (Champion/Legendary/Epic/Rare/Common)
  reason: "Extreme mode",       // Why this card is restricted (optional)
  created_at: "2025-02-27..."   // When restriction was created (optional)
}
```

## Usage Examples

### Basic Display

```jsx
import RestrictionCard from './components/RestrictionCard';
import { restrictionsService } from './services/restrictionsService';

function PlayerRestrictionsView({ seasonId, playerId }) {
  const [restrictions, setRestrictions] = useState([]);

  useEffect(() => {
    const loadRestrictions = async () => {
      const data = await restrictionsService.fetchRestrictions(seasonId);
      const playerRestrictions = data.find(p => p.player_id === playerId);
      setRestrictions(playerRestrictions?.restrictions || []);
    };
    loadRestrictions();
  }, [seasonId, playerId]);

  return (
    <RestrictionCard
      player={playerInfo}
      restrictedCards={restrictions}
      onDeleteCard={(restrictionId) => {
        // Handle single card deletion
      }}
      onDeleteAll={(playerId) => {
        // Handle clear all
      }}
    />
  );
}
```

### With Delete Handlers

```jsx
function SeasonRestrictionsManager({ seasonId, playerData }) {
  const handleDeleteCard = async (restrictionId) => {
    try {
      await restrictionsService.deleteRestriction(restrictionId);
      // Refresh restrictions
      loadRestrictions();
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  };

  const handleClearAll = async (playerId) => {
    try {
      const playerRestrictions = restrictions.find(p => p.player_id === playerId);
      if (playerRestrictions?.restrictions) {
        const restrictionIds = playerRestrictions.restrictions.map(r => r.restriction_id);
        await restrictionsService.bulkDeleteRestrictions(restrictionIds);
        loadRestrictions();
      }
    } catch (error) {
      console.error('Failed to clear all:', error);
    }
  };

  return (
    <RestrictionCard
      player={playerData}
      restrictedCards={playerData.restrictions}
      onDeleteCard={handleDeleteCard}
      onDeleteAll={handleClearAll}
    />
  );
}
```

### In a List with Multiple Players

```jsx
function AllPlayersRestrictions({ seasonId }) {
  const [allRestrictions, setAllRestrictions] = useState([]);

  useEffect(() => {
    const loadAll = async () => {
      const data = await restrictionsService.fetchRestrictions(seasonId);
      setAllRestrictions(data);
    };
    loadAll();
  }, [seasonId]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {allRestrictions.map(playerGroup => (
        <RestrictionCard
          key={playerGroup.player_id}
          player={{
            player_id: playerGroup.player_id,
            name: playerGroup.player_name,
            zone_name: playerGroup.zone_name
          }}
          restrictedCards={playerGroup.restrictions}
          onDeleteCard={deleteRestriction}
          onDeleteAll={clearAllRestrictions}
        />
      ))}
    </div>
  );
}
```

### With Undo Support

```jsx
function RestrictionsWithUndo() {
  const [deletedItems, setDeletedItems] = useState([]);

  const handleDeleteCard = async (restrictionId) => {
    const restriction = allRestrictions
      .flatMap(p => p.restrictions)
      .find(r => r.restriction_id === restrictionId);

    await restrictionsService.deleteRestriction(restrictionId);
    setDeletedItems([...deletedItems, restriction]);
    loadRestrictions();
  };

  const handleUndo = async () => {
    if (deletedItems.length === 0) return;

    const lastDeleted = deletedItems[deletedItems.length - 1];
    await restrictionsService.createRestriction(lastDeleted);
    setDeletedItems(deletedItems.slice(0, -1));
    loadRestrictions();
  };

  return (
    <>
      {deletedItems.length > 0 && (
        <button onClick={handleUndo} className="mb-4 bg-blue-500 text-white px-4 py-2 rounded">
          Undo Last Delete ({deletedItems.length})
        </button>
      )}

      <div className="grid grid-cols-3 gap-4">
        {allRestrictions.map(playerGroup => (
          <RestrictionCard
            key={playerGroup.player_id}
            {...playerGroup}
            onDeleteCard={handleDeleteCard}
            onDeleteAll={clearAllRestrictions}
          />
        ))}
      </div>
    </>
  );
}
```

## Data Flow

```
restrictionsService.fetchRestrictions(seasonId)
    ↓
Returns: [{
  player_id,
  player_name,
  restrictions: [
    {restriction_id, card_id, card_name, rarity, ...},
    ...
  ]
}]
    ↓
Pass to RestrictionCard component
    ↓
Component groups by rarity
    ↓
User clicks delete button
    ↓
onDeleteCard(restrictionId) callback
    ↓
Parent handles deletion + refresh
    ↓
Component re-renders with updated list
```

## Styling & Theming

### Color System
- **Trigger Button**: Blue theme (`bg-brand/20 border-brand/30`)
- **Background**: Slate 800/900 with transparency for layering
- **Text**: White for primary, slate-400/500 for secondary
- **Borders**: Slate-700/50 for subtle separation
- **Hover States**: Lighter backgrounds, enhanced colors

### Rarity Border Colors

| Rarity | Hover State | Colors |
|--------|------------|--------|
| Champion | Scales, brightens | `border-yellow-500/50` → `hover:border-yellow-400` |
| Legendary | Scales, brightens | `border-orange-500/50` → `hover:border-orange-400` |
| Epic | Scales, brightens | `border-purple-500/50` → `hover:border-purple-400` |
| Rare | Scales, brightens | `border-blue-500/50` → `hover:border-blue-400` |
| Common | Scales, brightens | `border-slate-500/50` → `hover:border-slate-400` |

### Responsive Design
- Card grid adapts to container width
- On small screens: Full width single column
- Avatar and player info stay visible at all sizes
- Delete buttons accessible even on mobile (hover → touch)

## Accessibility Features

### Keyboard Support
| Interaction | Action |
|------------|--------|
| `Tab` | Move focus between cards and buttons |
| `Delete` | Remove focused card from restrictions |
| `Backspace` | Remove focused card from restrictions |
| `Space/Enter` | Activate "Clear All" or confirmation buttons |

### Screen Reader Support
- Player avatar labeled with first initial
- All buttons have descriptive `aria-label`
- Cards labeled with name and rarity
- Zone grouping is semantic with headers
- Clear All actions are explicit

### Visual Indicators
- Focus rings on keyboard navigation
- Hover effects clear and visible
- Delete button appears in contrasting color (red)
- Confirmation dialog is modal-like (blocks background interactions)

## Error Handling

### Missing Data
- **No Card Name**: Shows "Unknown"
- **No Zone**: Shows "—"
- **No Nick**: Card displays name only without nick prefix
- **Unknown Rarity**: Defaults to common styling (gray border)

### Graceful Degradation
- All error cases display readable fallbacks
- Component continues rendering even with partial data
- No breaking errors for missing optional fields

## Performance Considerations

### 1. Memoized Grouping
- `useMemo` caches grouped/sorted cards
- Only recalculates when `restrictedCards` prop changes
- Prevents unnecessary re-organizations

### 2. Optimized Rendering
- Card grid uses no virtual scrolling (typically <50 cards per player)
- Hover state isolated to single card via `hoveredCardId` state
- Tooltip only renders for hovered item

### 3. Scalability
- Tested with 50+ cards per player
- Rarity grouping keeps cards organized visually
- Performance remains smooth with full grouping

## Testing

Component has 45+ test cases covering:
- Player info rendering
- Empty states
- Card grouping by rarity
- Rarity sorting within groups
- Delete single card (hover + button + keyboard)
- Clear all (confirmation flow)
- Accessibility features
- Edge cases (missing data, unknown rarity, etc.)

Run tests:
```bash
npm run test -- RestrictionCard.test.jsx
```

## Troubleshooting

### Delete button not appearing on hover

**Issue**: Hovering over card doesn't show delete button

**Solutions**:
1. Verify `onDeleteCard` and `onDeleteAll` callbacks are defined
2. Ensure component re-renders when hovering (check React DevTools)
3. Check CSS for conflicting hover handlers
4. Try using keyboard delete (Delete/Backspace) as alternative

### Card name not showing

**Issue**: Card displays "Unknown" instead of name

**Solutions**:
1. Verify `card_name` field is populated in restriction object
2. Check that restrictionsService.fetchRestrictions() includes card names
3. Look for null/undefined values in restrictedCards array
4. Ensure card query correctly joins with card table

### Clear All confirmation not showing

**Issue**: Clicking Clear All immediately calls callback without confirmation

**Solutions**:
1. If `onApprovedDelete={true}`, that's expected - remove to show confirmation
2. Check that state update is happening (React DevTools)
3. Verify onClick handler is properly bound
4. Try hard refresh (Ctrl+Shift+R) to clear old component code

### Colors not matching rarity

**Issue**: Card border colors don't match expected rarity colors

**Solutions**:
1. Verify rarity value is one of: Champion, Legendary, Epic, Rare, Common
2. Check case sensitivity - function converts to lowercase
3. Ensure Tailwind CSS is properly compiled with color classes
4. Try browser console: `document.querySelector('[role="img"]').className`

## Related Components

- **CardGrid**: Similar card selection interface
  - Both use rarity-based coloring
  - Both have rarity grouping/filtering
  - Complements RestrictionCard for admin workflows

- **PlayerMultiSelect**: For choosing players to restrict
  - Feeds into RestrictionCard via parent component
  - Sequential workflow: select players → assign cards → view restrictions

- **restrictionsService**: Backend integration
  - `fetchRestrictions()` - get restrictions for a season
  - `deleteRestriction()` - remove single restriction
  - `bulkDeleteRestrictions()` - remove multiple restrictions

## Future Enhancements

1. **Bulk Actions**: Select multiple cards for deletion
2. **Restriction Reasons**: Show/edit why card is restricted
3. **History**: Track when restrictions added/removed by whom
4. **Timestamps**: Show restriction creation date with relative time
5. **Impact Analytics**: Show which decks use restricted cards
6. **Unban Schedule**: Show when restriction expires (if temporary)
7. **Card Images**: Load from Supercell CDN instead of placeholder
8. **Preview Modal**: Click card to see full details and usage stats
9. **Batch Operations**: Select multiple players for bulk clear
10. **Export**: Download restrictions as CSV for records

## Dependencies

- **React 18+**: Hooks (useState, useCallback, useMemo)
- **Tailwind CSS 3+**: Styling with dark mode support
- **cardParser**: For rarity information (optional - using rarity field from data)

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Files

- **Component**: `packages/liga-admin/src/components/RestrictionCard.jsx`
- **Tests**: `packages/liga-admin/src/components/RestrictionCard.test.jsx`
- **Documentation**: `packages/liga-admin/src/components/RESTRICTIONCARD.md` (this file)

## Integration Points

### restrictionsService Integration

```jsx
import { restrictionsService } from '../services/restrictionsService';

// Fetch all restrictions for a season
const allRestrictions = await restrictionsService.fetchRestrictions(seasonId);

// Each player group can be passed to RestrictionCard:
{allRestrictions.map(playerGroup => (
  <RestrictionCard
    key={playerGroup.player_id}
    player={{...}} // Extract from playerGroup
    restrictedCards={playerGroup.restrictions}
    onDeleteCard={restrictionsService.deleteRestriction}
    onDeleteAll={(playerId) => {
      // Get restrictions for this player and bulk delete
    }}
  />
))}
```

### Real-time Updates

```jsx
// Subscribe to restriction changes
useEffect(() => {
  const subscription = restrictionsService.subscribeToRestrictions(seasonId, (changes) => {
    // Refresh restrictions when changes detected
    loadRestrictions();
  });
  return () => subscription.unsubscribe();
}, [seasonId]);
```
