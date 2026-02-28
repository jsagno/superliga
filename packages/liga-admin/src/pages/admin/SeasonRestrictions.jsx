/**
 * SeasonRestrictions Page
 * View and manage card restrictions (RES) for a season
 *
 * Features:
 * - Display all card restrictions grouped by player
 * - Search by player name or card name (debounced 300ms)
 * - Filter by zone
 * - Delete individual restrictions with undo support
 * - Delete all restrictions for a player with confirmation
 * - Real-time subscription to restriction changes
 * - Empty states for no data / no search results
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { restrictionsService } from '../../services/restrictionsService';
import RestrictionCard from '../../components/RestrictionCard';

export default function SeasonRestrictions() {
  const { seasonId } = useParams();
  const navigate = useNavigate();

  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [restrictions, setRestrictions] = useState([]);
  const [zones, setZones] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedZone, setSelectedZone] = useState('all');
  const [season, setSeason] = useState(null);

  // Undo state
  const [undoStack, setUndoStack] = useState([]);
  const [showUndo, setShowUndo] = useState(false);
  const [undoTimer, setUndoTimer] = useState(null);

  // Toast state
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  // Debounce search (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.toLowerCase());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load season info
  useEffect(() => {
    if (seasonId) {
      loadSeasonInfo();
      loadZones();
    }
  }, [seasonId]);

  // Load restrictions on mount
  useEffect(() => {
    if (seasonId) {
      loadRestrictions();
    }
  }, [seasonId]);

  // Real-time subscription
  useEffect(() => {
    if (!seasonId) return;

    const subscription = restrictionsService.subscribeToRestrictions(
      seasonId,
      (payload) => {
        console.log('Real-time update:', payload);
        // Reload restrictions on any change
        loadRestrictions();
      }
    );

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [seasonId]);

  const loadSeasonInfo = async () => {
    try {
      const { data, error } = await supabase
        .from('season')
        .select('season_id, description, status, era:era_id(description)')
        .eq('season_id', seasonId)
        .single();

      if (error) throw error;
      setSeason(data);
    } catch (err) {
      console.error('Error loading season info:', err);
    }
  };

  const loadZones = async () => {
    try {
      const { data, error } = await supabase
        .from('season_zone')
        .select('zone_id, name')
        .eq('season_id', seasonId)
        .order('name');

      if (error) throw error;
      setZones(data || []);
    } catch (err) {
      console.error('Error loading zones:', err);
    }
  };

  const loadRestrictions = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await restrictionsService.fetchRestrictions(seasonId);
      setRestrictions(data || []);
    } catch (err) {
      console.error('Error loading restrictions:', err);
      setError(err.message || 'Failed to load restrictions');
    } finally {
      setLoading(false);
    }
  };

  // Show toast message
  const showToast = useCallback((message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: '', type: 'success' });
    }, 5000);
  }, []);

  // Delete single restriction with undo
  const handleDeleteCard = useCallback(
    async (restrictionId) => {
      try {
        // Find the restriction being deleted
        const restriction = restrictions
          .flatMap(p => p.restrictions)
          .find(r => r.restriction_id === restrictionId);

        if (!restriction) return;

        // Delete from database
        const deleted = await restrictionsService.deleteRestriction(restrictionId);

        // Update local state (optimistic)
        setRestrictions(prev =>
          prev.map(player => ({
            ...player,
            restrictions: player.restrictions.filter(r => r.restriction_id !== restrictionId),
          })).filter(player => player.restrictions.length > 0)
        );

        // Setup undo
        setUndoStack([{ type: 'single', data: deleted }]);
        setShowUndo(true);

        // Clear previous timer
        if (undoTimer) clearTimeout(undoTimer);

        // Auto-hide undo after 5 seconds
        const timer = setTimeout(() => {
          setShowUndo(false);
          setUndoStack([]);
        }, 5000);
        setUndoTimer(timer);

        showToast(`Restriction removed for ${restriction.card_name}`, 'success');
      } catch (err) {
        console.error('Error deleting restriction:', err);
        showToast('Failed to delete restriction', 'error');
      }
    },
    [restrictions, undoTimer, showToast]
  );

  // Delete all player restrictions with confirmation
  const handleDeleteAll = useCallback(
    async (playerId) => {
      const playerGroup = restrictions.find(p => p.player_id === playerId);
      if (!playerGroup) return;

      const count = playerGroup.restrictions.length;
      const confirmMsg = `Delete ALL ${count} restrictions from ${playerGroup.player_name}?`;

      if (!window.confirm(confirmMsg)) return;

      try {
        const restrictionIds = playerGroup.restrictions.map(r => r.restriction_id);

        // Delete from database
        const result = await restrictionsService.bulkDeleteRestrictions(restrictionIds);

        // Update local state
        setRestrictions(prev => prev.filter(p => p.player_id !== playerId));

        // Setup undo
        setUndoStack([{ type: 'bulk', data: result.deleted, playerId }]);
        setShowUndo(true);

        // Clear previous timer
        if (undoTimer) clearTimeout(undoTimer);

        // Auto-hide undo after 5 seconds
        const timer = setTimeout(() => {
          setShowUndo(false);
          setUndoStack([]);
        }, 5000);
        setUndoTimer(timer);

        showToast(`Deleted ${result.success} restrictions`, 'success');
      } catch (err) {
        console.error('Error deleting all restrictions:', err);
        showToast('Failed to delete restrictions', 'error');
      }
    },
    [restrictions, undoTimer, showToast]
  );

  // Undo delete operation
  const handleUndo = useCallback(async () => {
    if (undoStack.length === 0) return;

    const undoItem = undoStack[0];

    try {
      if (undoItem.type === 'single') {
        // Restore single restriction
        await restrictionsService.createRestriction({
          season_id: seasonId,
          player_id: undoItem.data.player_id,
          card_id: undoItem.data.card_id,
          reason: undoItem.data.reason,
          created_by: undoItem.data.created_by,
        });
      } else if (undoItem.type === 'bulk') {
        // Restore bulk restrictions
        const restrictions = undoItem.data.map(r => ({
          season_id: seasonId,
          player_id: r.player_id,
          card_id: r.card_id,
          reason: r.reason,
          created_by: r.created_by,
        }));
        await restrictionsService.bulkCreateRestrictions(restrictions, seasonId);
      }

      // Reload restrictions
      await loadRestrictions();

      // Clear undo
      setShowUndo(false);
      setUndoStack([]);
      if (undoTimer) clearTimeout(undoTimer);

      showToast('Deletion undone', 'success');
    } catch (err) {
      console.error('Error undoing deletion:', err);
      showToast('Failed to undo deletion', 'error');
    }
  }, [undoStack, seasonId, undoTimer, showToast]);

  // Filter restrictions by search and zone
  const filteredRestrictions = useMemo(() => {
    const normalizeText = value =>
      (value || '')
        .toString()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();

    let filtered = restrictions;

    // Filter by zone
    if (selectedZone !== 'all') {
      filtered = filtered.filter(p => p.zone_id === selectedZone);
    }

    // Filter by search (player name or card name)
    const query = normalizeText(debouncedSearch);

    if (query) {
      filtered = filtered.filter(playerGroup => {
        const matchesPlayerName = normalizeText(playerGroup.player_name).includes(query);
        const matchesPlayerNick = normalizeText(playerGroup.player_nick).includes(query);

        const matchesCard = playerGroup.restrictions.some(r =>
          normalizeText(r.card_name).includes(query)
        );

        return matchesPlayerName || matchesPlayerNick || matchesCard;
      });
    }

    return filtered;
  }, [restrictions, selectedZone, debouncedSearch]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <div className="h-8 w-64 bg-slate-700 animate-pulse rounded"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-64 bg-slate-800 animate-pulse rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <p className="text-red-400">Error: {error}</p>
          <button
            onClick={loadRestrictions}
            className="mt-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Restricciones de Cartas (RES)
          </h1>
          {season && (
            <p className="text-sm text-slate-400 mt-1">
              {season.era?.description} - {season.description}
            </p>
          )}
        </div>
        <button
          onClick={() => navigate(`/admin/seasons/${seasonId}/restrictions/edit`)}
          disabled={season?.status === 'CLOSED'}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            season?.status === 'CLOSED'
              ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
              : 'bg-brand hover:bg-brand-hover text-white'
          }`}
        >
          + Add Restriction
        </button>
      </div>

      {/* Search and Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search Input */}
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search players or cards..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Zone Filter */}
        <div className="w-full sm:w-48">
          <select
            value={selectedZone}
            onChange={e => setSelectedZone(e.target.value)}
            className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">All Zones</option>
            {zones.map(zone => (
              <option key={zone.zone_id} value={zone.zone_id}>
                {zone.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Results Counter */}
      {(searchQuery || selectedZone !== 'all') && (
        <div className="flex items-center justify-between text-sm text-slate-400">
          <p>
            {filteredRestrictions.length} player
            {filteredRestrictions.length !== 1 ? 's' : ''} found
          </p>
          {(searchQuery || selectedZone !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedZone('all');
              }}
              className="text-blue-400 hover:text-blue-300"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Restrictions List */}
      {filteredRestrictions.length === 0 ? (
        <div className="text-center py-16">
          {restrictions.length === 0 ? (
            // No restrictions at all
            <div>
              <p className="text-slate-400 text-lg mb-4">No hay restricciones</p>
              <button
                onClick={() => navigate(`/admin/seasons/${seasonId}/restrictions/edit`)}
                className="px-4 py-2 bg-brand hover:bg-brand-hover text-white rounded-lg font-medium"
              >
                Add Restriction
              </button>
            </div>
          ) : (
            // No results from search/filter
            <div>
              <p className="text-slate-400 text-lg mb-2">
                No results for "{searchQuery}"
              </p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedZone('all');
                }}
                className="text-blue-400 hover:text-blue-300"
              >
                Clear search
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRestrictions.map(playerGroup => (
            <RestrictionCard
              key={playerGroup.player_id}
              player={{
                player_id: playerGroup.player_id,
                name: playerGroup.player_name,
                nick: playerGroup.player_nick,
                zone_name: playerGroup.zone_name,
                image_url: playerGroup.image_url,
              }}
              restrictedCards={playerGroup.restrictions}
              onDeleteCard={handleDeleteCard}
              onDeleteAll={handleDeleteAll}
            />
          ))}
        </div>
      )}

      {/* Toast Notification */}
      {toast.show && (
        <div
          className={`fixed bottom-6 right-6 px-6 py-3 rounded-lg shadow-lg text-white z-50 ${
            toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Undo Toast */}
      {showUndo && (
        <div className="fixed bottom-6 right-6 bg-slate-800 border border-slate-600 px-6 py-3 rounded-lg shadow-lg z-50 flex items-center gap-4">
          <p className="text-white">Restriction deleted</p>
          <button
            onClick={handleUndo}
            className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded font-medium"
          >
            Undo
          </button>
          <button
            onClick={() => {
              setShowUndo(false);
              setUndoStack([]);
              if (undoTimer) clearTimeout(undoTimer);
            }}
            className="text-slate-400 hover:text-slate-300"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
