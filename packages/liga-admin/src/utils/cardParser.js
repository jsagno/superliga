/**
 * Card Parser Utility
 * Parses and formats card data from Supercell API raw_payload
 * Used across RES and Extreme features for consistent card handling
 */

/**
 * Parse card raw_payload from Supercell API into structured data
 * @param {Object} raw_payload - JSONB payload from card.raw_payload column
 * @returns {Object} Parsed card data { name, icon, rarity, elixir, maxLevel }
 */
export function parseCardPayload(raw_payload) {
  if (!raw_payload || typeof raw_payload !== 'object') {
    return {
      name: 'Unknown Card',
      icon: null,
      rarity: 'common',
      elixir: 0,
      maxLevel: 14,
      iconEvolution: null,
      iconHero: null,
      hasEvolution: false,
      hasHero: false,
    };
  }

  return {
    name: raw_payload.name || 'Unknown Card',
    icon: raw_payload.iconUrls?.medium || null,
    iconEvolution: raw_payload.iconUrls?.evolutionMedium || null,
    iconHero: raw_payload.iconUrls?.heroMedium || null,
    hasEvolution: !!(raw_payload.iconUrls?.evolutionMedium && raw_payload.maxEvolutionLevel > 0),
    hasHero: !!raw_payload.iconUrls?.heroMedium,
    rarity: (raw_payload.rarity || 'common').toLowerCase(),
    elixir: raw_payload.elixirCost || 0,
    maxLevel: raw_payload.maxLevel || 14,
    maxEvolutionLevel: raw_payload.maxEvolutionLevel || 0,
  };
}

export function getCardVariantFromEvolutionLevel(evolutionLevel) {
  if (Number(evolutionLevel) === 2) return 'hero';
  if (Number(evolutionLevel) === 1) return 'evolution';
  return 'normal';
}

export function getCardVariantFromSelectionId(cardId) {
  if (typeof cardId !== 'string') {
    return 'normal';
  }

  if (cardId.endsWith('_hero')) return 'hero';
  if (cardId.endsWith('_evo')) return 'evolution';
  return 'normal';
}

export function getBaseCardId(cardId) {
  if (typeof cardId !== 'string') {
    return Number(cardId);
  }

  return Number(cardId.replace(/_(evo|hero)$/, ''));
}

export function getCardVariantLabel(variant) {
  switch ((variant || 'normal').toLowerCase()) {
    case 'hero':
      return 'Heroe';
    case 'evolution':
      return 'Evo';
    case 'all':
      return 'Todas';
    default:
      return 'Normal';
  }
}

export function getCardIconForVariant(cardData, variant) {
  if (!cardData) return null;

  switch ((variant || 'normal').toLowerCase()) {
    case 'hero':
      return cardData.iconHero || cardData.iconEvolution || cardData.icon || null;
    case 'evolution':
      return cardData.iconEvolution || cardData.icon || null;
    case 'all':
      return cardData.iconHero || cardData.iconEvolution || cardData.icon || null;
    default:
      return cardData.icon || null;
  }
}

/**
 * Get Tailwind text/bg color classes for card rarity
 * @param {string} rarity - Card rarity (common, rare, epic, legendary, champion)
 * @returns {Object} { text: string, bg: string, bgHover: string }
 */
export function getRarityColor(rarity) {
  const rarityLower = (rarity || 'common').toLowerCase();
  
  const colorMap = {
    champion: {
      text: 'text-amber-400',
      bg: 'bg-amber-500/10',
      bgHover: 'hover:bg-amber-500/20',
      gradient: 'from-amber-500 to-yellow-600',
    },
    legendary: {
      text: 'text-orange-400',
      bg: 'bg-orange-500/10',
      bgHover: 'hover:bg-orange-500/20',
      gradient: 'from-orange-500 to-red-600',
    },
    epic: {
      text: 'text-purple-400',
      bg: 'bg-purple-500/10',
      bgHover: 'hover:bg-purple-500/20',
      gradient: 'from-purple-500 to-pink-600',
    },
    rare: {
      text: 'text-blue-400',
      bg: 'bg-blue-500/10',
      bgHover: 'hover:bg-blue-500/20',
      gradient: 'from-blue-500 to-cyan-600',
    },
    common: {
      text: 'text-gray-400',
      bg: 'bg-gray-500/10',
      bgHover: 'hover:bg-gray-500/20',
      gradient: 'from-gray-500 to-slate-600',
    },
  };

  return colorMap[rarityLower] || colorMap.common;
}

/**
 * Get Tailwind border color classes for card rarity
 * @param {string} rarity - Card rarity
 * @returns {Object} { border: string, borderHover: string }
 */
export function getRarityBorder(rarity) {
  const rarityLower = (rarity || 'common').toLowerCase();
  
  const borderMap = {
    champion: {
      border: 'border-amber-500/30',
      borderHover: 'hover:border-amber-500',
      ring: 'ring-amber-500/50',
    },
    legendary: {
      border: 'border-orange-500/30',
      borderHover: 'hover:border-orange-500',
      ring: 'ring-orange-500/50',
    },
    epic: {
      border: 'border-purple-500/30',
      borderHover: 'hover:border-purple-500',
      ring: 'ring-purple-500/50',
    },
    rare: {
      border: 'border-blue-500/30',
      borderHover: 'hover:border-blue-500',
      ring: 'ring-blue-500/50',
    },
    common: {
      border: 'border-gray-500/30',
      borderHover: 'hover:border-gray-500',
      ring: 'ring-gray-500/50',
    },
  };

  return borderMap[rarityLower] || borderMap.common;
}

/**
 * Get numeric sort order for card rarity (highest rarity first)
 * @param {string} rarity - Card rarity
 * @returns {number} Sort order (0 = champion, 4 = common)
 */
export function getRarityOrder(rarity) {
  const rarityLower = (rarity || 'common').toLowerCase();
  
  const orderMap = {
    champion: 0,
    legendary: 1,
    epic: 2,
    rare: 3,
    common: 4,
  };

  return orderMap[rarityLower] ?? 4;
}

/**
 * Get human-readable rarity label with proper capitalization
 * @param {string} rarity - Card rarity
 * @returns {string} Formatted rarity label
 */
export function getRarityLabel(rarity) {
  const rarityLower = (rarity || 'common').toLowerCase();
  
  const labelMap = {
    champion: 'Champion',
    legendary: 'Legendary',
    epic: 'Epic',
    rare: 'Rare',
    common: 'Common',
  };

  return labelMap[rarityLower] || 'Common';
}

/**
 * Get rarity emoji/icon representation
 * @param {string} rarity - Card rarity
 * @returns {string} Emoji representing rarity
 */
export function getRarityEmoji(rarity) {
  const rarityLower = (rarity || 'common').toLowerCase();
  
  const emojiMap = {
    champion: '👑',
    legendary: '⭐',
    epic: '💜',
    rare: '🔷',
    common: '⚪',
  };

  return emojiMap[rarityLower] || '⚪';
}

/**
 * Sort cards by rarity (highest first), then by name alphabetically
 * @param {Array} cards - Array of card objects with raw_payload
 * @returns {Array} Sorted cards
 */
export function sortCardsByRarity(cards) {
  return [...cards].sort((a, b) => {
    const rarityA = a.raw_payload?.rarity || 'common';
    const rarityB = b.raw_payload?.rarity || 'common';
    
    const orderA = getRarityOrder(rarityA);
    const orderB = getRarityOrder(rarityB);
    
    // First sort by rarity
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    
    // Then by name alphabetically
    const nameA = a.name || '';
    const nameB = b.name || '';
    return nameA.localeCompare(nameB);
  });
}

/**
 * Filter cards by rarity
 * @param {Array} cards - Array of card objects
 * @param {string|Array<string>} rarities - Single rarity or array of rarities to filter
 * @returns {Array} Filtered cards
 */
export function filterCardsByRarity(cards, rarities) {
  const rarityArray = Array.isArray(rarities) ? rarities : [rarities];
  const raritySet = new Set(rarityArray.map(r => r.toLowerCase()));
  
  return cards.filter(card => {
    const cardRarity = (card.raw_payload?.rarity || 'common').toLowerCase();
    return raritySet.has(cardRarity);
  });
}

/**
 * Group cards by rarity
 * @param {Array} cards - Array of card objects
 * @returns {Object} Cards grouped by rarity { champion: [], legendary: [], ... }
 */
export function groupCardsByRarity(cards) {
  const groups = {
    champion: [],
    legendary: [],
    epic: [],
    rare: [],
    common: [],
  };
  
  cards.forEach(card => {
    const rarity = (card.raw_payload?.rarity || 'common').toLowerCase();
    if (groups[rarity]) {
      groups[rarity].push(card);
    } else {
      groups.common.push(card); // Fallback to common for unknown rarities
    }
  });
  
  return groups;
}

/**
 * Get elixir cost badge color
 * @param {number} elixirCost - Elixir cost (0-10)
 * @returns {string} Tailwind color class for elixir badge
 */
export function getElixirColor(elixirCost) {
  if (elixirCost <= 2) return 'bg-green-500';
  if (elixirCost <= 4) return 'bg-blue-500';
  if (elixirCost <= 6) return 'bg-purple-500';
  return 'bg-red-500';
}

/**
 * Format card display name (capitalize each word)
 * @param {string} name - Card name
 * @returns {string} Formatted name
 */
export function formatCardName(name) {
  return (name || 'Unknown Card')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
