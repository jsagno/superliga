# Capability: RES Card Selector

## Overview

The Card Selector provides a visual, filterable interface for administrators to select one or more cards to restrict. Cards are displayed in a grid with card artwork, rarity indicators, and selection state. Filtering by rarity allows quick access to specific card types.

## User Stories

### Story 1: View All Available Cards

**As an** admin  
**I want to** see all Clash Royale cards in a visual grid  
**So that** I can browse and select cards to restrict

**Acceptance Criteria**:
- All cards from `card` table are displayed
- Each card shows: artwork, name, elixir cost, rarity
- Cards are ordered alphabetically within rarity groups
- Grid is responsive (3 cols mobile, 4-6 cols desktop)
- Loading skeleton shown while fetching cards

### Story 2: Filter Cards by Rarity

**As an** admin  
**I want to** filter cards by rarity  
**So that** I can quickly find specific card types

**Acceptance Criteria**:
- Filter pills shown: All, Champion, Legendary, Epic, Rare, Common
- Clicking pill updates grid immediately
- Active filter pill is highlighted
- Card count for each rarity displayed (e.g., "Champion (4)")
- Filter state persists during session

### Story 3: Select Multiple Cards

**As an** admin  
**I want to** select multiple cards at once  
**So that** I can efficiently create bulk restrictions

**Acceptance Criteria**:
- Clicking card toggles selection state
- Selected cards show visual indicator (checkmark overlay)
- Selection counter shows "X cards selected"
- "Clear Selection" button available when any selected
- Selection preserved when changing filters

### Story 4: Search Cards by Name

**As an** admin  
**I want to** search for cards by name  
**So that** I can quickly find specific cards

**Acceptance Criteria**:
- Search input above card grid
- Results update as user types (debounced 300ms)
- Case-insensitive partial matching
- "X cards found" counter displayed
- Works in combination with rarity filter

### Story 5: Card Details Tooltip

**As an** admin  
**I want to** see card details on hover  
**So that** I can confirm card identity

**Acceptance Criteria**:
- Hovering card shows tooltip with: full name, elixir cost, rarity, level range
- Tooltip appears after 500ms delay
- Tooltip follows cursor
- Tooltip doesn't obstruct adjacent cards

## Technical Specification

### Component API

```typescript
interface CardGridProps {
  selectedCards: string[];        // Array of card_ids
  onCardToggle: (cardId: string) => void;
  rarityFilter?: 'all' | 'champion' | 'legendary' | 'epic' | 'rare' | 'common';
  onRarityChange?: (rarity: string) => void;
  searchQuery?: string;
  maxSelection?: number;          // Optional limit (0 = unlimited)
}
```

### Component Structure

```jsx
<CardGrid>
  <CardGridHeader>
    <SearchBar 
      value={searchQuery}
      onChange={setSearchQuery}
    />
    <SelectionCounter count={selectedCards.length} />
    <ClearButton onClick={clearSelection} />
  </CardGridHeader>
  
  <RarityFilters>
    {rarities.map(rarity => (
      <RarityPill 
        key={rarity}
        rarity={rarity}
        count={cardCounts[rarity]}
        active={rarityFilter === rarity}
        onClick={() => onRarityChange(rarity)}
      />
    ))}
  </RarityFilters>
  
  <CardGridContainer>
    {filteredCards.map(card => (
      <CardItem
        key={card.card_id}
        card={card}
        isSelected={selectedCards.includes(card.card_id)}
        onToggle={() => onCardToggle(card.card_id)}
      />
    ))}
  </CardGridContainer>
  
  <EmptyState visible={filteredCards.length === 0} />
</CardGrid>
```

### Data Fetching

```javascript
const [cards, setCards] = useState([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  async function fetchCards() {
    const { data, error } = await supabase
      .from('card')
      .select('card_id, raw_payload')
      .order('raw_payload->name', { ascending: true });
    
    if (error) {
      toast.error('Error al cargar cartas');
      return;
    }
    
    // Parse raw_payload
    const parsedCards = data.map(card => ({
      card_id: card.card_id,
      name: card.raw_payload.name,
      icon: card.raw_payload.iconUrls.medium,
      rarity: card.raw_payload.rarity,
      elixirCost: card.raw_payload.elixirCost,
      maxLevel: card.raw_payload.maxLevel,
    }));
    
    setCards(parsedCards);
    setLoading(false);
  }
  
  fetchCards();
}, []);
```

### Filtering Logic

```javascript
const filteredCards = useMemo(() => {
  let result = cards;
  
  // Apply rarity filter
  if (rarityFilter && rarityFilter !== 'all') {
    result = result.filter(card => card.rarity === rarityFilter);
  }
  
  // Apply search query
  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    result = result.filter(card => 
      card.name.toLowerCase().includes(query)
    );
  }
  
  // Sort by rarity then name
  const rarityOrder = { champion: 0, legendary: 1, epic: 2, rare: 3, common: 4 };
  result.sort((a, b) => {
    if (a.rarity !== b.rarity) {
      return rarityOrder[a.rarity] - rarityOrder[b.rarity];
    }
    return a.name.localeCompare(b.name);
  });
  
  return result;
}, [cards, rarityFilter, searchQuery]);
```

### Card Counts by Rarity

```javascript
const cardCounts = useMemo(() => {
  return cards.reduce((acc, card) => {
    acc[card.rarity] = (acc[card.rarity] || 0) + 1;
    return acc;
  }, {
    champion: 0,
    legendary: 0,
    epic: 0,
    rare: 0,
    common: 0,
  });
}, [cards]);
```

### Selection Handler

```javascript
function handleCardToggle(cardId) {
  if (selectedCards.includes(cardId)) {
    // Deselect
    onCardToggle(selectedCards.filter(id => id !== cardId));
  } else {
    // Select (check max limit)
    if (maxSelection > 0 && selectedCards.length >= maxSelection) {
      toast.warning(`Máximo ${maxSelection} cartas permitidas`);
      return;
    }
    onCardToggle([...selectedCards, cardId]);
  }
}
```

## UI Design

### Card Item

```jsx
<div 
  className={`
    relative cursor-pointer transition-transform hover:scale-105
    ${isSelected ? 'ring-2 ring-blue-500' : ''}
  `}
  onClick={onToggle}
>
  {/* Card Image */}
  <img 
    src={card.icon}
    alt={card.name}
    className={`
      w-full h-auto rounded-lg
      ${rarityBorder[card.rarity]}
    `}
  />
  
  {/* Selection Indicator */}
  {isSelected && (
    <div className="absolute top-1 right-1 bg-blue-500 rounded-full w-6 h-6 flex items-center justify-center">
      <span className="material-symbols-outlined text-white text-sm">
        check
      </span>
    </div>
  )}
  
  {/* Card Name */}
  <div className="text-center text-sm mt-1 truncate">
    {card.name}
  </div>
  
  {/* Elixir Cost Badge */}
  <div className="absolute bottom-6 left-1 bg-purple-600 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
    {card.elixirCost}
  </div>
</div>
```

### Rarity Pill

```jsx
<button
  onClick={onClick}
  className={`
    px-4 py-2 rounded-full font-medium transition
    ${active 
      ? 'bg-blue-500 text-white' 
      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}
  `}
>
  {rarity === 'all' ? 'Todas' : capitalizeRarity(rarity)}
  {count > 0 && (
    <span className="ml-2 text-sm opacity-75">
      ({count})
    </span>
  )}
</button>
```

### Rarity Border Styles

```javascript
const rarityBorder = {
  champion: 'border-4 border-yellow-500',
  legendary: 'border-4 border-orange-500',
  epic: 'border-4 border-purple-500',
  rare: 'border-4 border-blue-500',
  common: 'border-4 border-gray-500',
};
```

### Layout Example

```
┌──────────────────────────────────────────────────┐
│  🔍 Search cards...                              │
│  5 cards selected                    [Clear All] │
├──────────────────────────────────────────────────┤
│  [Todas (109)] [Champion (4)] [Legendary (21)]  │
│  [Epic (28)] [Rare (31)] [Common (25)]           │
├──────────────────────────────────────────────────┤
│                                                   │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐     │
│  │ ✓  │ │    │ │    │ │ ✓  │ │    │ │    │     │
│  │ 🃏 │ │ 🃏 │ │ 🃏 │ │ 🃏 │ │ 🃏 │ │ 🃏 │     │
│  │    │ │    │ │    │ │    │ │    │ │    │     │
│  │Arch│ │Dark│ │Fire│ │Gold│ │Ice │ │Litt│     │
│  │ 5  │ │ 4  │ │ 4  │ │ 3  │ │ 3  │ │ 1  │     │
│  └────┘ └────┘ └────┘ └────┘ └────┘ └────┘     │
│                                                   │
│  ... (more cards) ...                            │
│                                                   │
└──────────────────────────────────────────────────┘
```

### Empty State

```jsx
{filteredCards.length === 0 && (
  <div className="text-center py-12">
    <span className="material-symbols-outlined text-6xl text-gray-600">
      style
    </span>
    <h3 className="text-xl font-semibold mt-4 mb-2">
      No se encontraron cartas
    </h3>
    <p className="text-gray-400">
      {searchQuery 
        ? `No hay cartas que coincidan con "${searchQuery}"`
        : 'No hay cartas disponibles para este filtro'}
    </p>
    {(searchQuery || rarityFilter !== 'all') && (
      <button
        onClick={clearFilters}
        className="mt-4 btn-secondary"
      >
        Limpiar Filtros
      </button>
    )}
  </div>
)}
```

## Performance Optimization

### Virtualization (if needed)

For large card catalogs (>200 cards), implement virtualization:

```javascript
import { useVirtualizer } from '@tanstack/react-virtual';

const parentRef = useRef();

const rowVirtualizer = useVirtualizer({
  count: Math.ceil(filteredCards.length / columnsPerRow),
  getScrollElement: () => parentRef.current,
  estimateSize: () => 150, // Row height
  overscan: 2,
});

return (
  <div ref={parentRef} className="h-[600px] overflow-auto">
    <div
      style={{
        height: `${rowVirtualizer.getTotalSize()}px`,
        position: 'relative',
      }}
    >
      {rowVirtualizer.getVirtualItems().map(virtualRow => {
        const startIdx = virtualRow.index * columnsPerRow;
        const rowCards = filteredCards.slice(startIdx, startIdx + columnsPerRow);
        
        return (
          <div
            key={virtualRow.index}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            {rowCards.map(card => <CardItem key={card.card_id} card={card} />)}
          </div>
        );
      })}
    </div>
  </div>
);
```

### Image Loading

```jsx
<img 
  src={card.icon}
  loading="lazy"
  onError={(e) => {
    e.target.src = '/placeholder-card.png';
  }}
/>
```

### Debounced Search

```javascript
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

const debouncedSearchQuery = useDebouncedValue(searchQuery, 300);
```

## Accessibility

- **Keyboard Navigation**:
  - Arrow keys to navigate between cards
  - Space/Enter to toggle selection
  - Tab to focus search and filters

- **ARIA Attributes**:
  ```jsx
  <div
    role="checkbox"
    aria-checked={isSelected}
    aria-label={`${card.name}, ${card.rarity}, ${card.elixirCost} elixir`}
    tabIndex={0}
  />
  ```

- **Screen Reader Support**:
  - Announce selection changes: "Archer Queen selected, 5 cards selected"
  - Announce filter changes: "Showing 21 legendary cards"

## Error Handling

| Error | User Message | Recovery |
|-------|--------------|----------|
| Failed to load cards | "Error al cargar catálogo de cartas" | Retry button |
| Invalid card data | "Datos de carta inválidos" | Skip card, show warning |
| Network timeout | "Error de conexión" | Auto-retry 3 times |
| Image load failure | (fallback placeholder) | Use generic card icon |

## BDD Scenarios

### Scenario: Select Multiple Cards

```gherkin
Given I am viewing the card grid
And no cards are selected
When I click on "Archer Queen"
And I click on "Dark Prince"
And I click on "Fireball"
Then 3 cards are visually selected
And the counter shows "3 cards selected"
And each selected card has a checkmark overlay
```

### Scenario: Filter Cards by Rarity

```gherkin
Given I am viewing all 109 cards
When I click the "Champion" filter pill
Then I see only 4 champion cards
And the pill is highlighted
And the counter shows "Champion (4)"
When I click "Legendary"
Then I see only 21 legendary cards
And the Champion pill is no longer highlighted
```

### Scenario: Search for Card

```gherkin
Given I am viewing all cards
When I type "queen" in the search box
Then I see cards: "Archer Queen", "Barbarian Queen", "Royal Queen"
And the counter shows "3 cards found"
When I clear the search
Then all 109 cards are visible again
```

### Scenario: Preserve Selection Across Filters

```gherkin
Given I have selected "Archer Queen" (Champion rarity)
And I have selected "Dark Prince" (Epic rarity)
When I filter by "Champion"
Then "Archer Queen" is still selected
And "Dark Prince" is not visible (different rarity)
When I filter by "All"
Then both cards are visible and selected
```

### Scenario: Maximum Selection Limit

```gherkin
Given maxSelection is set to 5
And I have selected 5 cards
When I attempt to select a 6th card
Then I see a warning "Maximum 5 cards allowed"
And the 6th card is not selected
```

## Testing Checklist

### Unit Tests
- [ ] Parse raw_payload correctly
- [ ] Filter by rarity
- [ ] Search by name
- [ ] Sort cards (rarity then name)
- [ ] Calculate card counts per rarity
- [ ] Handle selection toggle
- [ ] Enforce max selection limit

### Integration Tests
- [ ] Fetch cards from Supabase
- [ ] Handle missing/invalid card data
- [ ] Load card images
- [ ] Debounce search input

### E2E Tests
- [ ] View card grid with all cards
- [ ] Filter by each rarity
- [ ] Search for specific card
- [ ] Select multiple cards
- [ ] Clear selection
- [ ] Preserve selection across filters
- [ ] Keyboard navigation

## Dependencies

- `card` table with `raw_payload` column
- Supercell API card images (CDN)
- Material Symbols font (check icon)
- Tailwind CSS for styling
- Optional: @tanstack/react-virtual for performance

## Future Enhancements

- Sort by: Name, Elixir Cost, Rarity
- Multi-select via Shift+Click (range selection)
- Save favorite card sets
- Recently used cards quick access
- Card comparison view (side-by-side)
- Deck builder integration (suggest cards that fit deck archetypes)
- Card usage statistics (show which cards are most/least restricted)
