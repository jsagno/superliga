/**
 * Card Parser Usage Examples
 * Demonstrates how to use cardParser.js utilities
 * 
 * Run with: node packages/liga-admin/src/utils/cardParser.examples.js
 * (Requires ES modules support or transpilation)
 */

import {
  parseCardPayload,
  getRarityColor,
  getRarityBorder,
  getRarityOrder,
  getRarityLabel,
  getRarityEmoji,
  sortCardsByRarity,
  filterCardsByRarity,
  groupCardsByRarity,
  getElixirColor,
  formatCardName,
} from './cardParser.js';

// Sample card data from Supercell API (typical raw_payload structure)
const sampleCards = [
  {
    card_id: 26000000,
    name: 'Knight',
    raw_payload: {
      id: 26000000,
      name: 'Knight',
      iconUrls: {
        medium: 'https://api-assets.clashroyale.com/cards/300/JHWW7.png',
      },
      rarity: 'Common',
      elixirCost: 3,
      maxLevel: 14,
    },
  },
  {
    card_id: 26000001,
    name: 'Archers',
    raw_payload: {
      id: 26000001,
      name: 'Archers',
      iconUrls: {
        medium: 'https://api-assets.clashroyale.com/cards/300/JHWW8.png',
      },
      rarity: 'Common',
      elixirCost: 3,
      maxLevel: 14,
    },
  },
  {
    card_id: 26000002,
    name: 'Goblins',
    raw_payload: {
      id: 26000002,
      name: 'Goblins',
      iconUrls: {
        medium: 'https://api-assets.clashroyale.com/cards/300/JHWW9.png',
      },
      rarity: 'Common',
      elixirCost: 2,
      maxLevel: 14,
    },
  },
  {
    card_id: 26000003,
    name: 'Giant',
    raw_payload: {
      id: 26000003,
      name: 'Giant',
      iconUrls: {
        medium: 'https://api-assets.clashroyale.com/cards/300/JHWW10.png',
      },
      rarity: 'Rare',
      elixirCost: 5,
      maxLevel: 11,
    },
  },
  {
    card_id: 26000004,
    name: 'P.E.K.K.A',
    raw_payload: {
      id: 26000004,
      name: 'P.E.K.K.A',
      iconUrls: {
        medium: 'https://api-assets.clashroyale.com/cards/300/JHWW11.png',
      },
      rarity: 'Epic',
      elixirCost: 7,
      maxLevel: 8,
    },
  },
  {
    card_id: 26000005,
    name: 'Princess',
    raw_payload: {
      id: 26000005,
      name: 'Princess',
      iconUrls: {
        medium: 'https://api-assets.clashroyale.com/cards/300/JHWW12.png',
      },
      rarity: 'Legendary',
      elixirCost: 3,
      maxLevel: 5,
    },
  },
  {
    card_id: 26000006,
    name: 'Archer Queen',
    raw_payload: {
      id: 26000006,
      name: 'Archer Queen',
      iconUrls: {
        medium: 'https://api-assets.clashroyale.com/cards/300/JHWW13.png',
      },
      rarity: 'Champion',
      elixirCost: 5,
      maxLevel: 5,
    },
  },
  {
    card_id: 26000007,
    name: 'Golden Knight',
    raw_payload: {
      id: 26000007,
      name: 'Golden Knight',
      iconUrls: {
        medium: 'https://api-assets.clashroyale.com/cards/300/JHWW14.png',
      },
      rarity: 'Champion',
      elixirCost: 4,
      maxLevel: 5,
    },
  },
];

console.log('=== Card Parser Examples ===\n');

// Example 1: Parse raw_payload
console.log('1. Parse Card Payload:');
const knightParsed = parseCardPayload(sampleCards[0].raw_payload);
console.log('Knight parsed:', knightParsed);
console.log('  - Name:', knightParsed.name);
console.log('  - Icon:', knightParsed.icon);
console.log('  - Rarity:', knightParsed.rarity);
console.log('  - Elixir:', knightParsed.elixir);
console.log('  - Max Level:', knightParsed.maxLevel);
console.log('');

// Example 2: Get rarity colors
console.log('2. Rarity Colors:');
['champion', 'legendary', 'epic', 'rare', 'common'].forEach(rarity => {
  const colors = getRarityColor(rarity);
  console.log(`  ${getRarityEmoji(rarity)} ${getRarityLabel(rarity)}:`, colors.text);
});
console.log('');

// Example 3: Get rarity borders
console.log('3. Rarity Borders:');
['champion', 'legendary', 'epic', 'rare', 'common'].forEach(rarity => {
  const borders = getRarityBorder(rarity);
  console.log(`  ${getRarityLabel(rarity)}:`, borders.border);
});
console.log('');

// Example 4: Rarity sort order
console.log('4. Rarity Sort Orders:');
['champion', 'legendary', 'epic', 'rare', 'common'].forEach(rarity => {
  const order = getRarityOrder(rarity);
  console.log(`  ${getRarityLabel(rarity)}: ${order}`);
});
console.log('');

// Example 5: Sort cards by rarity
console.log('5. Sort Cards by Rarity (highest first):');
const sortedCards = sortCardsByRarity(sampleCards);
sortedCards.forEach(card => {
  const parsed = parseCardPayload(card.raw_payload);
  console.log(`  ${getRarityEmoji(parsed.rarity)} ${card.name} (${getRarityLabel(parsed.rarity)}, ${parsed.elixir} elixir)`);
});
console.log('');

// Example 6: Filter by rarity
console.log('6. Filter Cards by Rarity (Champions only):');
const champions = filterCardsByRarity(sampleCards, 'champion');
champions.forEach(card => {
  console.log(`  👑 ${card.name}`);
});
console.log('');

console.log('7. Filter Cards by Multiple Rarities (Legendary + Champion):');
const highRarity = filterCardsByRarity(sampleCards, ['legendary', 'champion']);
highRarity.forEach(card => {
  const parsed = parseCardPayload(card.raw_payload);
  console.log(`  ${getRarityEmoji(parsed.rarity)} ${card.name}`);
});
console.log('');

// Example 8: Group by rarity
console.log('8. Group Cards by Rarity:');
const grouped = groupCardsByRarity(sampleCards);
Object.entries(grouped).forEach(([rarity, cards]) => {
  if (cards.length > 0) {
    console.log(`  ${getRarityEmoji(rarity)} ${getRarityLabel(rarity)} (${cards.length}):`);
    cards.forEach(card => console.log(`    - ${card.name}`));
  }
});
console.log('');

// Example 9: Elixir cost colors
console.log('9. Elixir Cost Colors:');
[1, 2, 3, 5, 7, 10].forEach(cost => {
  const color = getElixirColor(cost);
  console.log(`  ${cost} elixir: ${color}`);
});
console.log('');

// Example 10: Format card names
console.log('10. Format Card Names:');
['KNIGHT', 'archer queen', 'p.E.k.K.a', 'GiAnT'].forEach(name => {
  console.log(`  "${name}" → "${formatCardName(name)}"`);
});
console.log('');

// Example 11: Edge cases
console.log('11. Edge Cases:');
console.log('  Null payload:', parseCardPayload(null));
console.log('  Empty object:', parseCardPayload({}));
console.log('  Unknown rarity:', getRarityLabel('mythic'));
console.log('  Invalid rarity order:', getRarityOrder('invalid'));
console.log('');

// Example 12: React component usage (pseudo-code)
console.log('12. React Component Usage (pseudo-code):');
console.log(`
// In your React component:
import { parseCardPayload, getRarityColor, getRarityBorder } from './utils/cardParser';

function CardDisplay({ card }) {
  const parsed = parseCardPayload(card.raw_payload);
  const colors = getRarityColor(parsed.rarity);
  const borders = getRarityBorder(parsed.rarity);
  
  return (
    <div className={\`p-4 rounded-lg \${colors.bg} \${borders.border} border-2\`}>
      <img src={parsed.icon} alt={parsed.name} className="w-16 h-16" />
      <h3 className={colors.text}>{parsed.name}</h3>
      <span className="badge">{parsed.elixir} Elixir</span>
    </div>
  );
}
`);

console.log('=== Examples Complete ===');
