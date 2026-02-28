/**
 * PlayerMultiSelect Component
 * Multi-select dropdown for choosing players from a season's participants
 *
 * Features:
 * - Fetch all players participating in a season
 * - Group players by zone (ZONE A, ZONE B, etc.)
 * - Multi-select with search (debounced)
 * - Display selected players as chips
 * - Remove individual players or clear all
 * - Keyboard navigation (arrow keys, Enter, Escape)
 * - Full accessibility support
 * - Max selection limit enforcement
 *
 * Props:
 *   seasonId: string - Season UUID to fetch players for
 *   selectedPlayers: Array<{player_id: string, name: string}> - Currently selected
 *   onPlayerAdd: (player) => void - Callback when player added
 *   onPlayerRemove: (player) => void - Callback when player removed
 *   onClearAll: () => void - Callback when clear all clicked
 *   zoneFilter: string|null - Optional: only show players from specific zone
 *   excludePlayerIds: Array<string> - Optional: players to hide from selection
 *   maxSelection: number|null - Optional: max players that can be selected
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';

const PlayerMultiSelect = ({
  seasonId,
  selectedPlayers = [],
  onPlayerAdd = () => {},
  onPlayerRemove = () => {},
  onClearAll = () => {},
  zoneFilter = null,
  excludePlayerIds = [],
  maxSelection = null,
}) => {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const dropdownRef = useRef(null);
  const triggerRef = useRef(null);

  // Debounced search (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.toLowerCase());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch season participants on mount
  useEffect(() => {
    if (seasonId) {
      loadPlayers();
    }
  }, [seasonId]);

  const loadPlayers = useCallback(async () => {
    if (!seasonId) return;

    try {
      setLoading(true);
      setError(null);

      // Fetch players from season_zone_team_player (participants in this season)
      // Must join with season_zone to filter by season_id
      const { data, error: queryError } = await supabase
        .from('season_zone_team_player')
        .select(`
          player_id,
          zone_id,
          player:player_id (
            player_id,
            name,
            nick
          ),
          season_zone!zone_id!inner (
            zone_id,
            name,
            season_id
          )
        `)
        .eq('season_zone.season_id', seasonId);

      if (queryError) throw queryError;

      // Transform and deduplicate (in case player appears in multiple teams)
      const playerMap = new Map();
      (data || []).forEach(record => {
        const playerData = Array.isArray(record.player) ? record.player[0] : record.player;
        const zoneData = Array.isArray(record.season_zone) ? record.season_zone[0] : record.season_zone;

        if (!playerMap.has(record.player_id)) {
          playerMap.set(record.player_id, {
            player_id: record.player_id,
            name: playerData?.name || 'Unknown',
            nick: playerData?.nick || '',
            zone_id: record.zone_id,
            zone_name: zoneData?.name || 'Unknown Zone',
          });
        }
      });

      // Convert to array and sort by zone, then by name
      let result = Array.from(playerMap.values());
      result.sort((a, b) => {
        const zoneCompare = (a.zone_name || '').localeCompare(b.zone_name || '');
        if (zoneCompare !== 0) return zoneCompare;
        return (a.name || '').localeCompare(b.name || '');
      });

      setPlayers(result);
    } catch (err) {
      console.error('Error loading players:', err);
      setError(err.message || 'Failed to load players');
    } finally {
      setLoading(false);
    }
  }, [seasonId]);

  // Filter and group players
  const groupedPlayers = useMemo(() => {
    let filtered = players;

    // Apply zone filter
    if (zoneFilter) {
      filtered = filtered.filter(p => p.zone_id === zoneFilter);
    }

    // Apply exclude list
    if (excludePlayerIds.length > 0) {
      filtered = filtered.filter(p => !excludePlayerIds.includes(p.player_id));
    }

    // Apply search
    if (debouncedSearch) {
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(debouncedSearch) ||
        p.nick.toLowerCase().includes(debouncedSearch)
      );
    }

    // Group by zone
    const groups = {};
    filtered.forEach(p => {
      const zone = p.zone_name || 'Unknown';
      if (!groups[zone]) {
        groups[zone] = [];
      }
      groups[zone].push(p);
    });

    // Convert to array with zone info
    return Object.entries(groups)
      .sort(([zoneA], [zoneB]) => zoneA.localeCompare(zoneB))
      .map(([zone, zplayers]) => ({
        zone,
        players: zplayers.sort((a, b) => a.name.localeCompare(b.name)),
      }));
  }, [players, zoneFilter, excludePlayerIds, debouncedSearch]);

  // Flatten grouped players for keyboard navigation
  const flatPlayers = useMemo(() => {
    return groupedPlayers.flatMap(group => group.players);
  }, [groupedPlayers]);

  // Check if player is selected
  const isPlayerSelected = useCallback(
    playerId => selectedPlayers.some(p => p.player_id === playerId),
    [selectedPlayers]
  );

  // Handle player selection toggle
  const handlePlayerToggle = useCallback(
    player => {
      if (isPlayerSelected(player.player_id)) {
        onPlayerRemove(player);
      } else {
        if (maxSelection && selectedPlayers.length >= maxSelection) {
          alert(`Maximum ${maxSelection} players allowed`);
          return;
        }
        onPlayerAdd(player);
      }
    },
    [isPlayerSelected, selectedPlayers.length, maxSelection, onPlayerAdd, onPlayerRemove]
  );

  // Handle keyboard navigation in dropdown
  const handleDropdownKeyDown = useCallback(
    e => {
      if (!isOpen) {
        if (e.key === 'Enter' || e.key === ' ') {
          setIsOpen(true);
          e.preventDefault();
        }
        return;
      }

      let newIndex = focusedIndex;

      if (e.key === 'ArrowDown') {
        newIndex = Math.min(focusedIndex + 1, flatPlayers.length - 1);
        e.preventDefault();
      } else if (e.key === 'ArrowUp') {
        newIndex = Math.max(focusedIndex - 1, -1);
        e.preventDefault();
      } else if (e.key === 'Enter' && focusedIndex >= 0) {
        handlePlayerToggle(flatPlayers[focusedIndex]);
        e.preventDefault();
      } else if (e.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
        e.preventDefault();
      }

      if (newIndex !== focusedIndex) {
        setFocusedIndex(newIndex);
      }
    },
    [isOpen, focusedIndex, flatPlayers, handlePlayerToggle]
  );

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = e => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target) &&
        !triggerRef.current?.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
        <p className="text-red-400">Error loading players: {error}</p>
        <button
          onClick={loadPlayers}
          className="mt-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Selected Players Chips */}
      {selectedPlayers.length > 0 && (
        <div className="flex flex-wrap gap-2 p-3 bg-slate-900 rounded-lg border border-slate-700">
          {selectedPlayers.map(player => (
            <div
              key={player.player_id}
              className="flex items-center gap-2 px-3 py-1 bg-blue-500/20 border border-blue-500/30 rounded-full"
            >
              <span className="text-sm text-white">{player.name}</span>
              <button
                onClick={() => onPlayerRemove(player)}
                className="ml-1 text-blue-400 hover:text-blue-300 font-bold"
                aria-label={`Remove ${player.name}`}
              >
                ×
              </button>
            </div>
          ))}

          {selectedPlayers.length > 1 && (
            <button
              onClick={onClearAll}
              className="ml-auto text-xs text-slate-400 hover:text-slate-300 px-2 py-1"
              aria-label="Clear all players"
            >
              Clear All
            </button>
          )}
        </div>
      )}

      {/* Selection Counter */}
      {maxSelection && (
        <div className="text-xs text-slate-400">
          Selected: {selectedPlayers.length} / {maxSelection}
        </div>
      )}

      {/* Combobox Trigger & Dropdown */}
      <div className="relative" ref={dropdownRef}>
        {/* Trigger Button */}
        <button
          ref={triggerRef}
          onClick={() => setIsOpen(!isOpen)}
          onKeyDown={handleDropdownKeyDown}
          className="w-full px-4 py-2 text-left bg-slate-900 border border-slate-700 rounded-lg hover:border-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-label={`Select players: ${selectedPlayers.length} selected`}
        >
          <div className="flex items-center justify-between">
            <span className="text-slate-400">
              {selectedPlayers.length > 0
                ? `${selectedPlayers.length} player${selectedPlayers.length !== 1 ? 's' : ''} selected`
                : 'Select players...'}
            </span>
            <span className={`transform transition-transform ${isOpen ? 'rotate-180' : ''}`}>
              ▼
            </span>
          </div>
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <div
            className="absolute top-full left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto"
            role="listbox"
            onKeyDown={handleDropdownKeyDown}
          >
            {/* Search Input */}
            <div className="sticky top-0 bg-slate-900 border-b border-slate-700 p-2">
              <input
                type="text"
                placeholder="Search players..."
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  setFocusedIndex(-1);
                }}
                className="w-full px-3 py-2 bg-slate-800 text-white border border-slate-600 rounded focus:outline-none focus:border-blue-500 placeholder-slate-500 text-sm"
                aria-label="Search players"
              />
            </div>

            {/* Player Groups */}
            {loading ? (
              <div className="p-4 text-center text-slate-400">Loading players...</div>
            ) : flatPlayers.length === 0 ? (
              <div className="p-4 text-center text-slate-400">
                {players.length === 0 ? (
                  <p>No players available</p>
                ) : (
                  <p>{`No players found for "${searchQuery}"`}</p>
                )}
              </div>
            ) : (
              groupedPlayers.map((group, groupIndex) => (
                <div key={group.zone}>
                  {/* Zone Header */}
                  <div className="sticky top-12 px-4 py-2 bg-slate-800 border-b border-slate-700 text-xs font-semibold text-slate-400 uppercase">
                    {group.zone} ({group.players.length})
                  </div>

                  {/* Player Items */}
                  {group.players.map((player, playerIndex) => {
                    const globalIndex = flatPlayers.indexOf(player);
                    const isFocused = focusedIndex === globalIndex;
                    const isSelected = isPlayerSelected(player.player_id);

                    return (
                      <button
                        key={player.player_id}
                        onClick={() => handlePlayerToggle(player)}
                        onMouseEnter={() => setFocusedIndex(globalIndex)}
                        className={`w-full px-4 py-3 text-left border-b border-slate-800 transition-colors flex items-center gap-3 ${
                          isFocused ? 'bg-slate-800' : isSelected ? 'bg-slate-900/50' : 'hover:bg-slate-800'
                        } ${isSelected ? 'opacity-60' : ''}`}
                        role="option"
                        aria-selected={isSelected}
                        aria-label={`${player.name}${isSelected ? ', selected' : ''}`}
                      >
                        {/* Checkmark */}
                        <div className="w-5 h-5 rounded border border-slate-500 flex items-center justify-center">
                          {isSelected && (
                            <svg
                              className="w-4 h-4 text-blue-400"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                          )}
                        </div>

                        {/* Player Info */}
                        <div className="flex-1 min-w-0">
                          <div className={`font-medium ${isSelected ? 'text-slate-500' : 'text-white'}`}>
                            {player.name}
                          </div>
                          {player.nick && (
                            <div className={`text-xs ${isSelected ? 'text-slate-600' : 'text-slate-400'}`}>
                              {player.nick}
                            </div>
                          )}
                        </div>

                        {/* Selection Indicator */}
                        {isSelected && (
                          <span className="text-xs text-blue-400 font-semibold">Selected</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Help Text */}
      {!selectedPlayers.length && (
        <p className="text-xs text-slate-500">Click to select players from this season</p>
      )}
    </div>
  );
};

export default PlayerMultiSelect;
