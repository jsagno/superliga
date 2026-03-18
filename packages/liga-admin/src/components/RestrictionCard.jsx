/**
 * RestrictionCard Component
 * Displays a player's restricted cards for the current season
 *
 * Features:
 * - Show player info (name, zone, nick) with avatar image
 * - Display restricted cards as images organized by rarity
 * - Rarity-based border colors (champion, legendary, epic, rare, common)
 * - Hover to reveal delete button for individual cards
 * - "Clear All" button to remove all restrictions for this player
 * - Confirmation dialog before clearing all
 * - Smooth transitions and hover effects
 * - Full accessibility support
 * - Image fallbacks for players and cards
 *
 * Props:
 *   player: {player_id, name, nick, zone_name, image_url} - Player information
 *   restrictedCards: [{restriction_id, card_id, card_name, rarity, card_parsed: {icon}, ...}] - Cards restricted
 *   onDeleteCard: (restrictionId) => void - Callback when card delete clicked
 *   onDeleteAll: (playerId) => void - Callback when clear all clicked
 *   onApprovedDelete: boolean - Optional: skip confirmation dialog
 */

import React, { useState, useCallback, useMemo } from 'react';
import unnamed from '../assets/unnamed.png';

const RestrictionCard = ({
  player,
  restrictedCards = [],
  onDeleteCard = () => {},
  onDeleteAll = () => {},
  onApprovedDelete = false,
}) => {
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [hoveredCardId, setHoveredCardId] = useState(null);

  // Group and sort cards by rarity
  const groupedCards = useMemo(() => {
    const groups = {
      champion: [],
      legendary: [],
      epic: [],
      rare: [],
      common: [],
    };

    restrictedCards.forEach(card => {
      const rarity = (card.rarity || 'common').toLowerCase();
      if (groups[rarity]) {
        groups[rarity].push(card);
      } else {
        groups.common.push(card);
      }
    });

    // Sort cards within each rarity by name
    Object.keys(groups).forEach(rarity => {
      groups[rarity].sort((a, b) =>
        (a.card_name || '').localeCompare(b.card_name || '')
      );
    });

    // Return non-empty groups
    return Object.entries(groups)
      .filter(([_, cards]) => cards.length > 0)
      .map(([rarity, cards]) => ({
        rarity: rarity.charAt(0).toUpperCase() + rarity.slice(1),
        rarityLower: rarity,
        cards,
      }));
  }, [restrictedCards]);

  // Get rarity color/emoji for styling
  const getRarityBorder = useCallback(rarity => {
    const rarity_lower = (rarity || 'common').toLowerCase();
    switch (rarity_lower) {
      case 'champion':
        return 'border-yellow-500/50 hover:border-yellow-400';
      case 'legendary':
        return 'border-orange-500/50 hover:border-orange-400';
      case 'epic':
        return 'border-purple-500/50 hover:border-purple-400';
      case 'rare':
        return 'border-blue-500/50 hover:border-blue-400';
      case 'common':
        return 'border-slate-500/50 hover:border-slate-400';
      default:
        return 'border-slate-500/50 hover:border-slate-400';
    }
  }, []);

  const getRarityEmoji = useCallback(rarity => {
    const rarity_lower = (rarity || 'common').toLowerCase();
    switch (rarity_lower) {
      case 'champion':
        return '👑';
      case 'legendary':
        return '⭐';
      case 'epic':
        return '💜';
      case 'rare':
        return '💙';
      case 'common':
        return '⚪';
      default:
        return '⚪';
    }
  }, []);

  // Handle clear all with confirmation
  const handleClearAll = useCallback(() => {
    if (onApprovedDelete || showClearConfirm) {
      onDeleteAll(player.player_id);
      setShowClearConfirm(false);
    } else {
      setShowClearConfirm(true);
    }
  }, [player.player_id, onDeleteAll, onApprovedDelete, showClearConfirm]);

  if (restrictedCards.length === 0) {
    return (
      <div className="p-4 bg-slate-800/50 border border-slate-700/50 rounded-lg text-center text-slate-400">
        <p className="text-sm">{player.name} has no restricted cards</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg overflow-hidden hover:border-slate-600/50 transition-colors">
      {/* Player Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700/50 bg-slate-900/30">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Player Avatar Image */}
          <div className="w-10 h-10 rounded-full bg-slate-700 flex-shrink-0 overflow-hidden border border-slate-600">
            <img
              src={player.image_url || unnamed}
              alt={player.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.src = unnamed;
              }}
            />
          </div>

          {/* Player Info */}
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-white truncate">{player.name}</h3>
            <p className="text-xs text-slate-400 truncate">
              {player.nick && `${player.nick} • `}
              {player.zone_name || '—'}
            </p>
          </div>
        </div>

        {/* Card Count Badge */}
        <div className="ml-3 px-3 py-1 rounded-full bg-brand/20 border border-brand/30 flex-shrink-0">
          <span className="text-sm font-medium text-brand">
            {restrictedCards.length}
          </span>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="p-4 space-y-4">
        {groupedCards.map(group => (
          <div key={group.rarityLower}>
            {/* Rarity Header */}
            <div className="flex items-center gap-2 mb-2 px-2">
              <span className="text-lg">{getRarityEmoji(group.rarityLower)}</span>
              <span className="text-xs font-semibold text-slate-400 uppercase">
                {group.rarity} ({group.cards.length})
              </span>
            </div>

            {/* Cards Row */}
            <div className="flex flex-wrap gap-2">
              {group.cards.map(card => (
                <div
                  key={card.restriction_id}
                  className="relative group"
                  onMouseEnter={() => setHoveredCardId(card.restriction_id)}
                  onMouseLeave={() => setHoveredCardId(null)}
                >
                  {/* Card Thumbnail */}
                  <div
                    className={`
                      w-16 h-24 rounded-lg border-2 transition-all
                      bg-slate-700 flex flex-col items-center justify-center overflow-hidden
                      cursor-pointer hover:scale-105 hover:shadow-lg relative
                      ${getRarityBorder(card.rarity)}
                    `}
                    role="img"
                    aria-label={`${card.card_name}, ${card.rarity}, variante ${card.restriction_variant_label || 'Normal'}`}
                    tabIndex={0}
                    onKeyDown={e => {
                      if (e.key === 'Delete' || e.key === 'Backspace') {
                        onDeleteCard(card.restriction_id);
                        e.preventDefault();
                      }
                    }}
                  >
                    {/* Card Image */}
                    {card.card_parsed?.icon ? (
                      <img
                        src={card.card_parsed.icon}
                        alt={card.card_name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.parentElement.classList.add('flex', 'flex-col', 'items-center', 'justify-center');
                          const shield = e.currentTarget.parentElement.querySelector('div');
                          if (!shield) {
                            const fallback = document.createElement('div');
                            fallback.className = 'text-2xl';
                            fallback.textContent = '🛡️';
                            e.currentTarget.parentElement.appendChild(fallback);
                          }
                        }}
                      />
                    ) : (
                      <div className="text-2xl">🛡️</div>
                    )}
                    {/* Card Name Overlay (when image is present) */}
                    {card.card_parsed?.icon && (
                      <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-1 py-0.5">
                        <p className="text-xs font-bold text-white text-center leading-tight truncate">
                          {card.card_name || 'Unknown'}
                        </p>
                      </div>
                    )}

                    <div className="absolute top-1 left-1 rounded-full bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      {card.restriction_variant_label || 'Normal'}
                    </div>
                  </div>

                  {/* Delete Button - appears on hover */}
                  {hoveredCardId === card.restriction_id && (
                    <button
                      onClick={() => onDeleteCard(card.restriction_id)}
                      className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center font-bold text-sm shadow-lg transition-colors transform hover:scale-110"
                      title={`Remove ${card.card_name}`}
                      aria-label={`Remove ${card.card_name}`}
                    >
                      ×
                    </button>
                  )}

                  {/* Tooltip on hover */}
                  {hoveredCardId === card.restriction_id && (
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-white whitespace-nowrap pointer-events-none z-10">
                      {card.card_name} · {card.restriction_variant_label || 'Normal'}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Footer with Action */}
      <div className="p-4 border-t border-slate-700/50 bg-slate-900/20 flex items-center justify-between">
        <p className="text-xs text-slate-500">
          {restrictedCards.length} restricted cards
        </p>

        {!showClearConfirm ? (
          <button
            onClick={handleClearAll}
            className="px-3 py-1 text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
            aria-label={`Clear all restrictions for ${player.name}`}
          >
            Clear All
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <p className="text-xs text-slate-400">Remove all?</p>
            <button
              onClick={handleClearAll}
              className="px-2 py-1 text-xs font-medium bg-red-500 hover:bg-red-600 text-white rounded transition-colors"
              aria-label="Confirm clear all"
            >
              Yes
            </button>
            <button
              onClick={() => setShowClearConfirm(false)}
              className="px-2 py-1 text-xs font-medium bg-slate-600 hover:bg-slate-700 text-white rounded transition-colors"
              aria-label="Cancel clear all"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default RestrictionCard;
