/**
 * CardGrid Component
 * Interactive grid for selecting cards with filtering and search
 *
 * Features:
 * - Fetch and display all game cards
 * - Filter by rarity (Champion, Legendary, Epic, Rare, Common)
 * - Search by card name (debounced)
 * - Toggle card selection with max limit enforcement
 * - Keyboard navigation (arrow keys, Enter/Space to select)
 * - Responsive grid layout
 * - Accessibility (ARIA labels, semantic HTML)
 *
 * Props:
 *   selectedCards: Array<{card_id: number}> - Currently selected cards
 *   onCardToggle: (card) => void - Callback when card selection changes
 *   maxSelection: number - Max cards that can be selected (optional)
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import {
  parseCardPayload,
  getRarityColor,
  getRarityBorder,
  getRarityEmoji,
  getRarityLabel,
  sortCardsByRarity,
  groupCardsByRarity,
} from '../utils/cardParser';

// Rarity filter options for pills
const RARITIES = ['all', 'champion', 'legendary', 'epic', 'rare', 'common', 'evolution', 'hero'];

const CardGrid = ({ selectedCards = [], onCardToggle, maxSelection = null }) => {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRarity, setSelectedRarity] = useState('all');
  const [focusedCardIndex, setFocusedCardIndex] = useState(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounced search (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.toLowerCase());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch all cards on mount
  useEffect(() => {
    loadCards();
  }, []);

  const loadCards = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: queryError } = await supabase
        .from('card')
        .select('*')
        .order('name');

      if (queryError) throw queryError;

      // Parse each card's payload
      const parsedCards = (data || []).map(card => ({
        ...card,
        parsed: parseCardPayload(card.raw_payload),
      }));

      setCards(sortCardsByRarity(parsedCards));
    } catch (err) {
      console.error('Error loading cards:', err);
      setError(err.message || 'Failed to load cards');
    } finally {
      setLoading(false);
    }
  }, []);

  // Calculate card stats by rarity (including evolution and hero variants)
  const rarityStats = useMemo(() => {
    const stats = {
      all: 0,
      champion: 0,
      legendary: 0,
      epic: 0,
      rare: 0,
      common: 0,
      evolution: 0,
      hero: 0,
    };

    cards.forEach(card => {
      const rarity = (card.parsed?.rarity || 'common').toLowerCase();
      
      // Count normal version
      if (stats[rarity] !== undefined) {
        stats[rarity]++;
        stats.all++;
      }

      // Count evolution version if available
      if (card.parsed?.hasEvolution) {
        stats.evolution++;
        stats.all++;
      }

      // Count hero version if available
      if (card.parsed?.hasHero) {
        stats.hero++;
        stats.all++;
      }
    });

    return stats;
  }, [cards]);

  // Filter and search cards, expanding evolution/hero variants
  const filteredCards = useMemo(() => {
    let result = cards;

    // Apply rarity filter (variant filters are handled separately in expansion)
    if (selectedRarity !== 'all' && selectedRarity !== 'evolution' && selectedRarity !== 'hero') {
      result = result.filter(
        card => (card.parsed?.rarity || 'common').toLowerCase() === selectedRarity
      );
    }

    // Apply search filter
    if (debouncedSearch) {
      result = result.filter(card =>
        card.name.toLowerCase().includes(debouncedSearch)
      );
    }

    // Expand cards with evolution into separate variants
    const expanded = [];
    result.forEach(card => {
      if (selectedRarity === 'evolution') {
        // Only show evolution variants for this filter
        if (card.parsed?.hasEvolution) {
          expanded.push({
            ...card,
            variant: 'evolution',
            variantId: `${card.card_id}_evo`,
            displayName: `${card.name} (Evo)`,
            displayIcon: card.parsed?.iconEvolution,
          });
        }
      } else if (selectedRarity === 'hero') {
        // Only show hero variants for this filter
        if (card.parsed?.hasHero) {
          expanded.push({
            ...card,
            variant: 'hero',
            variantId: `${card.card_id}_hero`,
            displayName: `${card.name} (Heroe)`,
            displayIcon: card.parsed?.iconHero,
          });
        }
      } else {
        // Show normal + evolution + hero variants for this filter
        // Add normal version
        expanded.push({
          ...card,
          variant: 'normal',
          variantId: card.card_id,
          displayName: card.name,
          displayIcon: card.parsed?.icon,
        });

        // Add evolution version if available
        if (card.parsed?.hasEvolution) {
          expanded.push({
            ...card,
            variant: 'evolution',
            variantId: `${card.card_id}_evo`,
            displayName: `${card.name} (Evo)`,
            displayIcon: card.parsed?.iconEvolution,
          });
        }

        // Add hero version if available
        if (card.parsed?.hasHero) {
          expanded.push({
            ...card,
            variant: 'hero',
            variantId: `${card.card_id}_hero`,
            displayName: `${card.name} (Heroe)`,
            displayIcon: card.parsed?.iconHero,
          });
        }
      }
    });

    return expanded;
  }, [cards, selectedRarity, debouncedSearch]);

  // Check if card variant is selected
  const isCardSelected = useCallback(
    variantId => selectedCards.some(c => {
      return String(c.card_id) === String(variantId);
    }),
    [selectedCards]
  );

  const visibleSelectedCount = useMemo(
    () => filteredCards.filter(card => isCardSelected(card.variantId)).length,
    [filteredCards, isCardSelected]
  );

  const allVisibleSelected = filteredCards.length > 0 && visibleSelectedCount === filteredCards.length;
  const canBulkSelectVisible = filteredCards.length > 0 && !allVisibleSelected;
  const canBulkClearVisible = visibleSelectedCount > 0;

  // Handle card selection toggle (including evolution variants)
  const handleCardToggle = useCallback(
    cardVariant => {
      if (isCardSelected(cardVariant.variantId)) {
        // Deselect
        onCardToggle({ card_id: cardVariant.variantId });
      } else {
        // Select if under limit
        if (maxSelection && selectedCards.length >= maxSelection) {
          alert(`Maximum ${maxSelection} cards allowed`);
          return;
        }
        onCardToggle({
          card_id: cardVariant.variantId,
          name: cardVariant.displayName,
          displayName: cardVariant.displayName,
          displayIcon: cardVariant.displayIcon,
          variant: cardVariant.variant,
          parsed: cardVariant.parsed,
        });
      }
    },
    [isCardSelected, selectedCards.length, maxSelection, onCardToggle]
  );

  const handleToggleVisibleCards = useCallback(() => {
    if (!filteredCards.length) return;

    if (allVisibleSelected) {
      filteredCards.forEach(cardVariant => {
        onCardToggle({ card_id: cardVariant.variantId });
      });
      return;
    }

    const unselectedVisibleCards = filteredCards.filter(cardVariant => !isCardSelected(cardVariant.variantId));
    const remainingSlots = maxSelection ? Math.max(maxSelection - selectedCards.length, 0) : unselectedVisibleCards.length;
    const cardsToSelect = maxSelection ? unselectedVisibleCards.slice(0, remainingSlots) : unselectedVisibleCards;

    cardsToSelect.forEach(cardVariant => {
      onCardToggle({
        card_id: cardVariant.variantId,
        name: cardVariant.displayName,
        displayName: cardVariant.displayName,
        displayIcon: cardVariant.displayIcon,
        variant: cardVariant.variant,
        parsed: cardVariant.parsed,
      });
    });

    if (maxSelection && cardsToSelect.length < unselectedVisibleCards.length) {
      alert(`Only ${cardsToSelect.length} visible cards were selected because the maximum is ${maxSelection}.`);
    }
  }, [allVisibleSelected, filteredCards, isCardSelected, maxSelection, onCardToggle, selectedCards.length]);

  // Handle keyboard navigation and selection
  const handleGridKeyDown = useCallback(
    e => {
      if (!filteredCards.length) return;

      const currentIndex = focusedCardIndex ?? -1;
      let newIndex = currentIndex;

      if (e.key === 'ArrowRight') {
        newIndex = Math.min(currentIndex + 1, filteredCards.length - 1);
        e.preventDefault();
      } else if (e.key === 'ArrowLeft') {
        newIndex = Math.max(currentIndex - 1, 0);
        e.preventDefault();
      } else if (e.key === 'ArrowDown') {
        newIndex = Math.min(currentIndex + 6, filteredCards.length - 1);
        e.preventDefault();
      } else if (e.key === 'ArrowUp') {
        newIndex = Math.max(currentIndex - 6, 0);
        e.preventDefault();
      } else if (e.key === 'Enter' || e.key === ' ') {
        if (currentIndex >= 0 && currentIndex < filteredCards.length) {
          handleCardToggle(filteredCards[currentIndex]);
          e.preventDefault();
        }
      }

      if (newIndex !== currentIndex) {
        setFocusedCardIndex(newIndex);
      }
    },
    [filteredCards, focusedCardIndex, handleCardToggle]
  );

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
        <p className="text-red-400">Error loading cards: {error}</p>
        <button
          onClick={loadCards}
          className="mt-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search Box */}
      <div>
        <input
          type="text"
          placeholder="Search cards by name..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full px-4 py-2 bg-slate-900 text-white border border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 placeholder-slate-500"
          aria-label="Search cards"
        />
        {searchQuery && filteredCards.length === 0 && (
          <p className="text-slate-400 text-sm mt-2">
            No cards found matching "{searchQuery}"
            <button
              onClick={() => setSearchQuery('')}
              className="ml-2 text-blue-400 hover:underline"
            >
              Clear search
            </button>
          </p>
        )}
      </div>

      {/* Rarity Filter Pills */}
      <div className="flex flex-wrap gap-2">
        {RARITIES.map(rarity => {
          const isActive = selectedRarity === rarity;
          const displayName =
            rarity === 'all'
              ? 'All'
              : rarity === 'evolution'
                ? 'Evolution'
                : rarity === 'hero'
                  ? 'Heroe'
                  : getRarityLabel(rarity);
          const count = rarityStats[rarity];

          // Special styling for variant filters
          let buttonClass;
          if (rarity === 'evolution' || rarity === 'hero') {
            buttonClass = `px-4 py-2 rounded-full font-medium transition-colors ${
              isActive
                ? rarity === 'evolution'
                  ? 'bg-purple-500/20 text-purple-400 ring-2 ring-purple-400'
                  : 'bg-rose-500/20 text-rose-400 ring-2 ring-rose-400'
                : rarity === 'evolution'
                  ? 'bg-purple-500/10 text-purple-300 hover:bg-purple-500/20'
                  : 'bg-rose-500/10 text-rose-300 hover:bg-rose-500/20'
            }`;
          } else {
            const colors = getRarityColor(rarity === 'all' ? 'common' : rarity);
            buttonClass = `px-4 py-2 rounded-full font-medium transition-colors ${
              isActive
                ? `${colors.bg} ${colors.text} ring-2 ${colors.text.replace('text', 'ring')}`
                : `${colors.bg} ${colors.text} hover:${colors.bgHover}`
            }`;
          }

          return (
            <button
              key={rarity}
              onClick={() => setSelectedRarity(rarity)}
              className={buttonClass}
              aria-pressed={isActive}
              aria-label={`Filter by ${displayName} (${count} cards)`}
            >
              {rarity === 'evolution' ? (
                <span className="mr-1">✨</span>
              ) : rarity === 'hero' ? (
                <span className="mr-1">🦸</span>
              ) : rarity !== 'all' ? (
                <span className="mr-1">{getRarityEmoji(rarity)}</span>
              ) : null}
              {displayName} ({count})
            </button>
          );
        })}
      </div>

      {/* Selection Info */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-slate-400">
          {maxSelection ? `Selected: ${selectedCards.length} / ${maxSelection}` : `Selected: ${selectedCards.length}`}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleToggleVisibleCards}
            disabled={!filteredCards.length || (!canBulkSelectVisible && !canBulkClearVisible)}
            className="px-3 py-1.5 rounded-lg border border-slate-600 bg-slate-900 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {allVisibleSelected ? 'Quitar visibles' : 'Seleccionar visibles'}
          </button>
          <span className="text-xs text-slate-500">
            {visibleSelectedCount} de {filteredCards.length} visibles seleccionadas
          </span>
        </div>
      </div>

      {/* Card Grid */}
      <div
        role="grid"
        aria-label="Card selection grid"
        className="grid grid-cols-6 sm:grid-cols-8 lg:grid-cols-12 gap-3 auto-rows-max"
        onKeyDown={handleGridKeyDown}
      >
        {loading ? (
          // Loading skeletons
          Array(12)
            .fill(null)
            .map((_, i) => (
              <div
                key={i}
                className="aspect-square bg-slate-800 rounded-lg animate-pulse"
              />
            ))
        ) : filteredCards.length === 0 ? (
          // Empty state
          <div className="col-span-full text-center py-8 text-slate-400">
            {cards.length === 0 ? (
              <p>No cards loaded. Try refreshing.</p>
            ) : searchQuery ? (
              <p>No cards match your search "{searchQuery}"</p>
            ) : (
              <p>No cards available for the selected rarity</p>
            )}
          </div>
        ) : (
          // Card items
          filteredCards.map((card, index) => {
            const selected = isCardSelected(card.variantId);
            const isFocused = focusedCardIndex === index;
            const colors = getRarityColor(card.parsed?.rarity);
            const borders = getRarityBorder(card.parsed?.rarity);

            return (
              <button
                key={card.variantId}
                onClick={() => handleCardToggle(card)}
                onFocus={() => setFocusedCardIndex(index)}
                onBlur={() => setFocusedCardIndex(null)}
                className={`relative aspect-square rounded-lg border-2 transition-all overflow-hidden group ${
                  selected
                    ? `${borders.border} ${borders.ring} ring-2`
                    : `${borders.border} hover:${borders.borderHover}`
                } ${isFocused ? 'ring-2 ring-offset-2 ring-blue-500' : ''}`}
                aria-label={`${card.displayName}, ${getRarityLabel(card.parsed?.rarity)}, ${
                  card.parsed?.elixir
                } elixir${card.variant === 'evolution' ? ', evolution' : ''}${card.variant === 'hero' ? ', heroe' : ''}`}
                aria-pressed={selected}
                tabIndex={isFocused ? 0 : -1}
              >
                {/* Card image */}
                {card.displayIcon ? (
                  <img
                    src={card.displayIcon}
                    alt={card.displayName}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full bg-slate-700 flex items-center justify-center">
                    <span className="text-slate-400 text-xs">No image</span>
                  </div>
                )}

                {/* Evolution badge */}
                {card.variant === 'evolution' && (
                  <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded-full bg-purple-600/80 text-white text-xs font-bold shadow-md">
                    EVO
                  </div>
                )}

                {/* Hero badge */}
                {card.variant === 'hero' && (
                  <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded-full bg-rose-600/80 text-white text-xs font-bold shadow-md">
                    HERO
                  </div>
                )}

                {/* Rarity background tint */}
                <div
                  className={`absolute inset-0 opacity-0 group-hover:opacity-10 ${colors.bg} transition-opacity`}
                />

                {/* Selection checkmark */}
                {selected && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <svg
                      className="w-6 h-6 text-white drop-shadow-lg"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                )}

                {/* Card name tooltip (visible on hover/focus) */}
                <div className="absolute bottom-0 left-0 right-0 bg-black/80 px-2 py-1 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity translate-y-full group-hover:translate-y-0 whitespace-nowrap overflow-hidden text-ellipsis">
                  {card.name}
                </div>

                {/* Elixir cost badge */}
                {card.parsed?.elixir > 0 && (
                  <div className="absolute top-1 right-1 w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shadow-lg">
                    {card.parsed.elixir}
                  </div>
                )}
              </button>
            );
          })
        )}
      </div>

      {/* Results summary */}
      {!loading && filteredCards.length > 0 && (
        <p className="text-sm text-slate-400">
          Showing {filteredCards.length} of {cards.length} cards
        </p>
      )}
    </div>
  );
};

export default CardGrid;
