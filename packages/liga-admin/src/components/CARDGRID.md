# CardGrid Component Documentation

Interactive card selection grid for the RES (Restricciones Estacionales) feature with filtering, search, and keyboard navigation.

## Overview

The CardGrid component provides:
- 📱 **Responsive grid**: Auto-adjusts columns (3 mobile, 4 tablet, 6 desktop)
- 🔍 **Search**: Real-time card search with 300ms debouncing
- 🎨 **Rarity filtering**: Champion, Legendary, Epic, Rare, Common
- ✓ **Selection state**: Toggle cards with visual feedback
- ⌨️ **Keyboard navigation**: Arrow keys + Enter/Space to select
- ♿ **Accessibility**: Full ARIA labels, semantic HTML
- 🎯 **Max limit enforcement**: Optional selection limit
- 📊 **Statistics**: Card counts per rarity
- 🖼️ **Lazy loading**: Efficient image loading

## Installation

The component is in [src/components/CardGrid.jsx](./CardGrid.jsx)

## Usage

### Basic Usage

```javascript
import CardGrid from '../components/CardGrid';

function MyRestrictionsPage() {
  const [selectedCards, setSelectedCards] = useState([]);

  const handleCardToggle = (card) => {
    setSelectedCards(prev => {
      const exists = prev.some(c => c.card_id === card.card_id);
      if (exists) {
        return prev.filter(c => c.card_id !== card.card_id);
      } else {
        return [...prev, card];
      }
    });
  };

  return (
    <CardGrid
      selectedCards={selectedCards}
      onCardToggle={handleCardToggle}
    />
  );
}
```

### With Max Selection Limit

```javascript
<CardGrid
  selectedCards={selectedCards}
  onCardToggle={handleCardToggle}
  maxSelection={5}
/>
```

Enforces that users can't select more than 5 cards. Shows alert if limit reached.

### With Custom Handler

```javascript
const handleCardToggle = (card) => {
  console.log(`Card selected: ${card.name} (${card.card_id})`);
  
  // Save to database immediately
  saveRestriction(card);
  
  // Or add to selection list for batch save later
  addToSelection(card);
};

<CardGrid
  selectedCards={selectedCards}
  onCardToggle={handleCardToggle}
  maxSelection={10}
/>
```

## Props

### `selectedCards`
- **Type**: `Array<{card_id: number}>`
- **Default**: `[]`
- **Required**: No
- **Description**: Array of selected card objects. Each object must have `card_id` property.

```javascript
selectedCards={[
  { card_id: 26000000 },
  { card_id: 26000001 },
]}
```

### `onCardToggle`
- **Type**: `(card: Object) => void`
- **Default**: `undefined`
- **Required**: Yes (technically optional, but component won't be interactive without it)
- **Description**: Callback function called when a card is clicked. Receives the full card object.

```javascript
onCardToggle={(card) => {
  console.log('Card toggled:', card);
  // card.card_id, card.name, card.parsed.rarity, etc.
}}
```

### `maxSelection`
- **Type**: `number`
- **Default**: `null` (no limit)
- **Required**: No
- **Description**: Maximum number of cards that can be selected. Shows alert if exceeded.

```javascript
maxSelection={5} // Max 5 cards
```

## Features in Detail

### Search (Debounced)

- **300ms debounce**: Reduces re-renders while typing
- **Case-insensitive**: "KNIGHT" matches "knight"
- **Partial matching**: "ni" matches "Knight"
- **Clear button**: Appears only when search has text

```javascript
// User types "princess"
// Component waits 300ms after they stop typing
// Then filters cards matching the search
```

### Rarity Filtering

Six rarity levels with emoji and color coding:
- 👑 **Champion** (gold)
- ⭐ **Legendary** (orange)
- 💜 **Epic** (purple)  
- 🔷 **Rare** (blue)
- ⚪ **Common** (gray)
- **All** Shows all cards

Each pill displays the count of cards in that rarity:
```
👑 Champion (4)
⭐ Legendary (8)
💜 Epic (12)
...
```

### Selection State

Multiple visual indicators for selected cards:
- ✓ **Checkmark overlay**: Semi-transparent black with white checkmark
- 📍 **Ring border**: Colored ring around selected card
- `aria-pressed="true"`: Semantic HTML for accessibility

### Keyboard Navigation

| Key | Action |
|-----|--------|
| `←` Arrow Left | Move focus to previous card |
| `→` Arrow Right | Move focus to next card |
| `↑` Arrow Up | Move focus up 6 cards (row up) |
| `↓` Arrow Down | Move focus down 6 cards (row down) |
| `Enter` or `Space` | Toggle selection of focused card |
| `Tab` | Move focus to next interactive element |
| `Shift+Tab` | Move focus to previous interactive element |

**Example flow:**
```
1. Click on a card or press Tab to focus it
2. Use arrow keys to navigate
3. Press Space or Enter to select
4. Visual ring appears around focused card
5. Checkmark appears when selected
```

### Accessibility

**ARIA Labels:**
```
Card button: "Knight, Common, 3 elixir"
Search box: "Search cards by name..."
Grid container: "Card selection grid"
Filter pills: "Filter by Champion (4 cards)"
```

**Features:**
- ♿ Keyboard fully navigable
- 🏷️ Semantic HTML (<button>, <input>, role="grid")
- 📢 Screen reader support (aria-label, aria-pressed)
- 🎯 Focus management (visual ring around focused card)
- 🔄 State announced (selected/not selected)

**Testing accessibility:**
```javascript
// Test with keyboard only (no mouse)
// Test with screen reader enabled
// Use WAVE or axe DevTools for audit
```

### Responsive Grid

Grid columns adjust based on screen size:
```
Mobile (0-768px):       3 columns
Tablet (768px-1024px):  4 columns
Desktop (1024px+):      6 columns
```

Automatically reflows cards when window resizes.

### Loading State

Shows 12 animated skeleton placeholders while cards load:
```
┌─────┬─────┬─────┐
│ ▓▓▓ │ ▓▓▓ │ ▓▓▓ │  ← pulsing wave animation
├─────┼─────┼─────┤
│ ▓▓▓ │ ▓▓▓ │ ▓▓▓ │
└─────┴─────┴─────┘
```

Users see cards shimmer until fully loaded.

### Empty States

**No cards found (search):**
```
No cards match your search "xyz"
[Clear search]
```

**No cards for rarity:**
```
No cards available for the selected rarity
```

**All cards loaded:**
```
Showing 45 of 98 cards
```

## Component Structure

```
CardGrid
├── Search Input
│   └── Clear Button (if search active)
├── Rarity Filter Pills
│   ├── All (98)
│   ├── Champion (5)
│   ├── Legendary (12)
│   ├── Epic (25)
│   ├── Rare (38)
│   └── Common (18)
├── Selection Counter (if maxSelection set)
│   └── "Selected: 3 / 10"
├── Card Grid
│   ├── Loading Skeletons | Cards | Empty State
│   └── Card Item (repeated)
│       ├── Card Image
│       ├── Rarity Tint (on hover)
│       ├── Selection Checkmark (if selected)
│       ├── Card Name Tooltip (on hover)
│       └── Elixir Cost Badge
└── Results Summary
    └── "Showing 45 of 98 cards"
```

## Card Item Anatomy

```
┌──────────────────┐
│   Card Image     │  ← Lazy loaded, 16:16 aspect ratio
│                  │
│    ⭐ (emoji)    │  ← Optional elixir cost badge (top-right)
│                  │
│  [Selection ✓]   │  ← Shows checkmark if selected
│                  │
│  Knight          │  ← Name tooltip (hover only)
└──────────────────┘
```

**Colors based on rarity:**
- Border: Rarity-specific color (semi-transparent by default)
- Hover: Brightens border + semi-transparent rarity background
- Selected: Solid border + semi-transparent ringled border

## State Management

Component manages its own internal state:

```javascript
// Internal state (don't modify from parent)
[cards, setCards]              // Loaded card data
[loading, setLoading]          // Loading indicator
[error, setError]              // Error message
[searchQuery, setSearchQuery]   // Raw search input
[selectedRarity, setSelectedRarity]  // Active filter
[focusedCardIndex, setFocusedCardIndex]  // Keyboard focus
[debouncedSearch, setDebouncedSearch]  // Debounced search
```

**Parent controls:**
```javascript
// Props provided by parent
selectedCards: [...]     // Which cards are "selected"
onCardToggle: (card) => { ... }  // What happens on toggle
maxSelection: 5          // Selection limit
```

## Data Flow

```
Load on Mount
    ↓
Fetch 'card' table from Supabase
    ↓
Parse each card's raw_payload
    ↓
Sort by rarity (Champion→Common), then name
    ↓
Calculate statistics (count per rarity)
    ↓
Render grid with filters applied
    ↓
User interacts
    ├─ Search: Wait 300ms, filter by name
    ├─ Filter: Update rarity filter
    ├─ Click: Call onCardToggle callback
    └─ Keyboard: Navigate with arrow keys, select with Enter
```

## Performance Optimizations

1. **Debounced Search**: 300ms delay prevents excessive filtering
2. **useCallback**: Memoized functions prevent unnecessary re-renders
3. **useMemo**: Filtered results cached until dependencies change
4. **Lazy Loading**: Images load only when visible (`loading="lazy"`)
5. **Skeleton Screens**: Shows placeholders while loading
6. **Virtual Scrolling**: (Optional future enhancement for 1000+ cards)

## Common Use Cases

### Case 1: Restrict cards for a player

```javascript
function RestrictCardsPage({ seasonId, playerId }) {
  const [selectedCards, setSelectedCards] = useState([]);

  const handleSave = async () => {
    // Bulk create restrictions
    await restrictionsService.bulkCreateRestrictions(
      selectedCards.map(card => ({
        player_id: playerId,
        card_id: card.card_id,
        reason: 'Admin restriction',
        created_by: currentAdminId,
      })),
      seasonId
    );
    alert('Restrictions saved!');
  };

  return (
    <div>
      <h2>Select cards to restrict</h2>
      <CardGrid
        selectedCards={selectedCards}
        onCardToggle={(card) => {
          setSelectedCards(prev => {
            const exists = prev.some(c => c.card_id === card.card_id);
            return exists
              ? prev.filter(c => c.card_id !== card.card_id)
              : [...prev, card];
          });
        }}
        maxSelection={10}
      />
      <button onClick={handleSave} disabled={selectedCards.length === 0}>
        Save Restrictions ({selectedCards.length} cards)
      </button>
    </div>
  );
}
```

### Case 2: Extreme mode deck selection

```javascript
function SelectExtremeDeck({ seasonId, playerId }) {
  const [deckCards, setDeckCards] = useState([]);

  // Limit to exactly 3 cards for extreme mode
  return (
    <div>
      <CardGrid
        selectedCards={deckCards}
        onCardToggle={(card) => {
          setDeckCards(prev => {
            const exists = prev.some(c => c.card_id === card.card_id);
            return exists
              ? prev.filter(c => c.card_id !== card.card_id)
              : [...prev, card];
          });
        }}
        maxSelection={3}
      />
      {deckCards.length === 3 && <button>Confirm Extreme Deck</button>}
    </div>
  );
}
```

### Case 3: Bulk restriction import

```javascript
function BulkRestrictPage({ seasonId }) {
  const [selectedCards, setSelectedCards] = useState([]);
  const [selectedPlayers, setSelectedPlayers] = useState([]);

  const handleBulkCreate = async () => {
    // Cross product: every player gets every selected card restricted
    const restrictions = [];
    for (const player of selectedPlayers) {
      for (const card of selectedCards) {
        restrictions.push({
          player_id: player.player_id,
          card_id: card.card_id,
          reason: 'Bulk import',
          created_by: currentAdminId,
        });
      }
    }
    
    const result = await restrictionsService.bulkCreateRestrictions(
      restrictions,
      seasonId
    );
    alert(`Created ${result.success} restrictions`);
  };

  return (
    <div>
      <h3>Select Players</h3>
      <PlayerMultiSelect onChange={setSelectedPlayers} />
      
      <h3>Select Cards to Restrict</h3>
      <CardGrid
        selectedCards={selectedCards}
        onCardToggle={(card) => {
          setSelectedCards(prev => {
            const exists = prev.some(c => c.card_id === card.card_id);
            return exists
              ? prev.filter(c => c.card_id !== card.card_id)
              : [...prev, card];
          });
        }}
      />
      
      <button onClick={handleBulkCreate}>
        Create {selectedPlayers.length * selectedCards.length} Restrictions
      </button>
    </div>
  );
}
```

## Troubleshooting

### Cards not loading
- Check browser console for errors
- Verify Supabase is connected
- Check that `card` table exists and has data
- Try the Retry button

### Selection not working
- Verify `onCardToggle` callback is provided
- Check that `selectedCards` state is being updated
- Look for errors in parent component

### Search not debouncing
- 300ms delay is hardcoded - modify `useEffect` if needed
- Verify you're not typing into multiple inputs

### Keyboard navigation not working
- Focus must be on the grid or a card button
- Try clicking a card first, then use arrow keys
- Check browser console for event listener errors

### Rarity filter not working
- Verify cards have `raw_payload.rarity` field
- Check that rarity values match: champion, legendary, epic, rare, common
- Make sure `parseCardPayload` is working (check cardParser)

## Testing

Run tests with:
```bash
npm test -- CardGrid.test.jsx
```

Test coverage:
- ✓ Rendering (initial load, cards display)
- ✓ Selection (toggle, max limit, state display)
- ✓ Filtering (by rarity, filtering logic)
- ✓ Search (matching, case-insensitivity, clear)
- ✓ Keyboard navigation (arrow keys, Enter, Space)
- ✓ Accessibility (ARIA labels, focus management)
- ✓ Empty states (no results, no cards)
- ✓ Error handling (failed loads, retry)

## Related Components

- **CardGrid** (you are here) - Card selection
- **PlayerMultiSelect** (Task Group 5) - Player selection
- **RestrictionsList** (Task Group 6) - View restrictions
- **SeasonCardRestrictions** (Task Group 7) - Full admin page

## Related Files

- [cardParser.js](../utils/cardParser.js) - Card parsing utilities
- [restrictionsService.js](../services/restrictionsService.js) - Database service
- [CardGrid.test.jsx](./CardGrid.test.jsx) - Unit tests

## Future Enhancements

- Virtual scrolling for 1000+ cards (performance)
- Card preview modal (on double-click or modal trigger)
- Batch operations (select all champion cards)
- Card comparison view
- Recently restricted cards quick access
- Custom sort options (by name, by elixir, etc.)
