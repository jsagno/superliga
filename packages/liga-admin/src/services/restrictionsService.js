/**
 * RES (Restricciones Estacionales) Service Layer
 * Handles all database operations for season card restrictions
 */

import { supabase } from '../lib/supabaseClient';
import { parseCardPayload, sortCardsByRarity } from '../utils/cardParser';

// Configuration
const BATCH_SIZE = 50;

/**
 * Fetch all restrictions for a season with related player and card data
 * Groups by player_id and sorts cards by rarity
 * 
 * @param {string} seasonId - Season UUID
 * @returns {Promise<Array>} Restrictions grouped by player
 * @throws {Error} If query fails
 * 
 * @example
 * const restrictions = await fetchRestrictions(seasonId);
 * // Returns:
 * // [
 * //   {
 * //     player_id: 'uuid',
 * //     player_name: 'PlayerName',
 * //     zone_id: 'uuid',
 * //     restrictions: [
 * //       {
 * //         restriction_id: 'uuid',
 * //         card_id: 26000000,
 * //         card_name: 'Knight',
 * //         card_parsed: { name, icon, rarity, elixir, maxLevel },
 * //         reason: 'Optional reason',
 * //         created_by: 'uuid',
 * //         created_at: '2026-02-27T...'
 * //       }
 * //     ]
 * //   }
 * // ]
 */
export async function fetchRestrictions(seasonId) {
  if (!seasonId) {
    throw new Error('seasonId is required');
  }

  try {
    // Fetch restrictions with player and card info
    // Note: We need to get zone_id from season_zone_team_player for filtering
    const { data, error } = await supabase
      .from('season_card_restriction')
      .select(`
        restriction_id,
        player_id,
        card_id,
        reason,
        created_by,
        created_at,
        player:player_id (
          player_id,
          name,
          nick
        ),
        card:card_id (
          card_id,
          name,
          raw_payload
        )
      `)
      .eq('season_id', seasonId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Fetch zone information for all players in restrictions
    const playerIds = [...new Set((data || []).map(r => r.player_id))];
    
    let zoneMap = new Map();
    if (playerIds.length > 0) {
      const { data: zoneData, error: zoneError } = await supabase
        .from('season_zone_team_player')
        .select('player_id, zone_id, season_zone!inner(season_id, name)')
        .in('player_id', playerIds)
        .eq('season_zone.season_id', seasonId);

      if (!zoneError && zoneData) {
        zoneData.forEach(z => {
          const zoneName = Array.isArray(z.season_zone) 
            ? z.season_zone[0]?.name 
            : z.season_zone?.name;
          zoneMap.set(z.player_id, { 
            zone_id: z.zone_id, 
            zone_name: zoneName || 'Unknown Zone' 
          });
        });
      }
    }

    // Group restrictions by player and enrich with parsed card data
    const grouped = {};
    
    (data || []).forEach(restriction => {
      const playerId = restriction.player_id;
      const playerData = Array.isArray(restriction.player)
        ? restriction.player[0]
        : restriction.player;
      const cardData = Array.isArray(restriction.card)
        ? restriction.card[0]
        : restriction.card;
      
      if (!grouped[playerId]) {
        const zoneInfo = zoneMap.get(playerId);
        grouped[playerId] = {
          player_id: playerId,
          player_name: playerData?.name || 'Unknown',
          player_nick: playerData?.nick || '',
          image_url: null, // Player table doesn't have image columns
          zone_id: zoneInfo?.zone_id || null,
          zone_name: zoneInfo?.zone_name || null,
          restrictions: [],
        };
      }

      // Parse card payload for frontend rendering
      const cardParsed = parseCardPayload(cardData?.raw_payload);

      grouped[playerId].restrictions.push({
        restriction_id: restriction.restriction_id,
        card_id: restriction.card_id,
        card_name: cardData?.name || 'Unknown Card',
        card_parsed: cardParsed,
        reason: restriction.reason,
        created_by: restriction.created_by,
        created_at: restriction.created_at,
      });
    });

    // Convert to array and sort card restrictions by rarity within each player
    const result = Object.values(grouped).map(playerGroup => ({
      ...playerGroup,
      restrictions: playerGroup.restrictions.sort((a, b) => {
        // Sort by rarity first (highest first)
        const rarityOrder = {
          champion: 0,
          legendary: 1,
          epic: 2,
          rare: 3,
          common: 4,
        };
        const rarityA = rarityOrder[(a.card_parsed?.rarity || 'common').toLowerCase()] ?? 4;
        const rarityB = rarityOrder[(b.card_parsed?.rarity || 'common').toLowerCase()] ?? 4;
        
        if (rarityA !== rarityB) return rarityA - rarityB;
        
        // Then by card name
        return (a.card_name || '').localeCompare(b.card_name || '');
      }),
    }));

    return result;
  } catch (error) {
    console.error('Error fetching restrictions:', error);
    throw error;
  }
}

/**
 * Create a single card restriction
 * 
 * @param {Object} restriction - Restriction data
 * @param {string} restriction.season_id - Season UUID
 * @param {string} restriction.player_id - Player UUID
 * @param {number} restriction.card_id - Card ID
 * @param {string} restriction.reason - Optional reason for restriction
 * @param {string} restriction.created_by - Admin user UUID
 * @returns {Promise<Object>} Created restriction with ID
 * @throws {Error} If creation fails
 * 
 * @example
 * const result = await createRestriction({
 *   season_id: seasonId,
 *   player_id: playerId,
 *   card_id: 26000000,
 *   reason: 'Balance adjustment',
 *   created_by: adminId
 * });
 */
export async function createRestriction(restriction) {
  if (!restriction.season_id || !restriction.player_id || !restriction.card_id) {
    throw new Error('season_id, player_id, and card_id are required');
  }

  try {
    const { data, error } = await supabase
      .from('season_card_restriction')
      .insert({
        restriction_id: crypto.randomUUID(),
        season_id: restriction.season_id,
        player_id: restriction.player_id,
        card_id: restriction.card_id,
        reason: restriction.reason || null,
        created_by: restriction.created_by,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating restriction:', error);
    throw error;
  }
}

/**
 * Create multiple restrictions in batches
 * Uses upsert to handle duplicates gracefully
 * 
 * @param {Array} restrictions - Array of restriction objects
 * @param {string} seasonId - Season UUID for all restrictions
 * @returns {Promise<Object>} { success: number, failed: number, errors: Array }
 * @throws {Error} If all batches fail
 * 
 * @example
 * const result = await bulkCreateRestrictions([
 *   { player_id: 'uuid1', card_id: 26000000, reason: 'Ban', created_by: adminId },
 *   { player_id: 'uuid2', card_id: 26000001, reason: null, created_by: adminId },
 * ], seasonId);
 * // Returns: { success: 2, failed: 0, errors: [] }
 */
export async function bulkCreateRestrictions(restrictions, seasonId) {
  if (!restrictions || restrictions.length === 0) {
    return { success: 0, failed: 0, errors: [] };
  }

  if (!seasonId) {
    throw new Error('seasonId is required');
  }

  const errors = [];
  let successCount = 0;

  try {
    // Prepare rows with IDs and timestamps
    // Normalize card_id: remove '_evo' suffix if present (evolution cards use same base card_id)
    const rows = restrictions.map(r => {
      const normalizedCardId = typeof r.card_id === 'string' && r.card_id.endsWith('_evo')
        ? BigInt(r.card_id.replace('_evo', ''))
        : r.card_id;

      return {
        restriction_id: crypto.randomUUID(),
        season_id: seasonId,
        player_id: r.player_id,
        card_id: normalizedCardId,
        reason: r.reason || null,
        created_by: r.created_by,
        created_at: new Date().toISOString(),
      };
    });

    // Split into batches
    const batches = [];
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      batches.push(rows.slice(i, i + BATCH_SIZE));
    }

    console.log(`Bulking creating ${rows.length} restrictions in ${batches.length} batches`);

    // Execute each batch
    for (const [index, batch] of batches.entries()) {
      try {
        const { error } = await supabase
          .from('season_card_restriction')
          .upsert(batch, { onConflict: 'season_id,player_id,card_id' });

        if (error) throw error;
        successCount += batch.length;
        console.log(`Batch ${index + 1}/${batches.length} completed: ${batch.length} rows`);
      } catch (batchError) {
        console.error(`Batch ${index + 1} failed:`, batchError);
        errors.push({
          batch: index + 1,
          error: batchError.message,
          rows: batch.length,
        });
      }
    }
  } catch (error) {
    console.error('Error in bulk create:', error);
    throw error;
  }

  return {
    success: successCount,
    failed: restrictions.length - successCount,
    errors,
  };
}

/**
 * Delete a single restriction by ID
 * 
 * @param {string} restrictionId - Restriction UUID
 * @returns {Promise<Object>} Deleted restriction data
 * @throws {Error} If deletion fails
 * 
 * @example
 * const deleted = await deleteRestriction(restrictionId);
 */
export async function deleteRestriction(restrictionId) {
  if (!restrictionId) {
    throw new Error('restrictionId is required');
  }

  try {
    const { data, error } = await supabase
      .from('season_card_restriction')
      .delete()
      .eq('restriction_id', restrictionId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error deleting restriction:', error);
    throw error;
  }
}

/**
 * Delete multiple restrictions in batches
 * Supports rollback via returned data for undo functionality
 * 
 * @param {Array<string>} restrictionIds - Array of restriction UUIDs
 * @returns {Promise<Object>} { success: number, failed: number, deleted: Array, errors: Array }
 * @throws {Error} If all deletions fail
 * 
 * @example
 * const result = await bulkDeleteRestrictions([id1, id2, id3]);
 * // Returns: { success: 3, failed: 0, deleted: [...], errors: [] }
 */
export async function bulkDeleteRestrictions(restrictionIds) {
  if (!restrictionIds || restrictionIds.length === 0) {
    return { success: 0, failed: 0, deleted: [], errors: [] };
  }

  const deleted = [];
  const errors = [];
  let successCount = 0;

  try {
    // Split into batches
    const batches = [];
    for (let i = 0; i < restrictionIds.length; i += BATCH_SIZE) {
      batches.push(restrictionIds.slice(i, i + BATCH_SIZE));
    }

    console.log(`Bulk deleting ${restrictionIds.length} restrictions in ${batches.length} batches`);

    // Execute each batch
    for (const [index, batch] of batches.entries()) {
      try {
        const { data, error } = await supabase
          .from('season_card_restriction')
          .delete()
          .in('restriction_id', batch)
          .select();

        if (error) throw error;
        
        deleted.push(...(data || []));
        successCount += (data || []).length;
        console.log(`Batch ${index + 1}/${batches.length} completed: ${(data || []).length} rows deleted`);
      } catch (batchError) {
        console.error(`Batch ${index + 1} failed:`, batchError);
        errors.push({
          batch: index + 1,
          error: batchError.message,
          rows: batch.length,
        });
      }
    }
  } catch (error) {
    console.error('Error in bulk delete:', error);
    throw error;
  }

  return {
    success: successCount,
    failed: restrictionIds.length - successCount,
    deleted,
    errors,
  };
}

/**
 * Check if restrictions already exist for given combinations
 * Useful for preventing duplicates before bulk creates
 * 
 * @param {string} seasonId - Season UUID
 * @param {Array<string>} playerIds - Array of player UUIDs
 * @param {Array<number>} cardIds - Array of card IDs
 * @returns {Promise<Object>} Existing restrictions matching criteria
 * @throws {Error} If query fails
 * 
 * @example
 * const existing = await checkExistingRestrictions(
 *   seasonId,
 *   ['player1', 'player2'],
 *   [26000000, 26000001]
 * );
 * // Returns: [
 * //   { player_id: 'player1', card_id: 26000000, restriction_id: 'uuid' },
 * //   ...
 * // ]
 */
export async function checkExistingRestrictions(seasonId, playerIds, cardIds) {
  if (!seasonId || !playerIds?.length || !cardIds?.length) {
    return [];
  }

  try {
    const normalizedCardIds = cardIds.map(c => Number(c)).filter(c => !Number.isNaN(c));

    const { data, error } = await supabase
      .from('season_card_restriction')
      .select('restriction_id, season_id, player_id, card_id')
      .eq('season_id', seasonId)
      .in('player_id', playerIds)
      .in('card_id', normalizedCardIds);

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('Error checking existing restrictions:', error);
    throw error;
  }
}

/**
 * Subscribe to real-time changes for restrictions in a season
 * Used to keep UI synchronized across multiple admin sessions
 * 
 * @param {string} seasonId - Season UUID to watch
 * @param {Function} onUpdate - Callback when restrictions change
 * @returns {Object} Subscription object with unsubscribe method
 * 
 * @example
 * const subscription = subscribeToRestrictions(seasonId, (event) => {
 *   console.log('Restrictions changed:', event.eventType, event.new);
 * });
 * 
 * // Later, clean up:
 * subscription.unsubscribe();
 */
export function subscribeToRestrictions(seasonId, onUpdate) {
  if (!seasonId || !onUpdate) {
    throw new Error('seasonId and onUpdate callback are required');
  }

  const subscription = supabase
    .channel(`restrictions/${seasonId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'season_card_restriction',
        filter: `season_id=eq.${seasonId}`,
      },
      (payload) => {
        onUpdate({
          eventType: payload.eventType,
          new: payload.new,
          old: payload.old,
          timestamp: new Date(),
        });
      }
    )
    .subscribe((status) => {
      console.log(`Restrictions subscription status: ${status}`);
    });

  return subscription;
}

/**
 * Get statistics for a season's restrictions
 * Useful for dashboard/overview displays
 * 
 * @param {string} seasonId - Season UUID
 * @returns {Promise<Object>} Statistics object
 * @throws {Error} If query fails
 * 
 * @example
 * const stats = await getRestrictionStats(seasonId);
 * // Returns: {
 * //   total_restrictions: 15,
 * //   affected_players: 8,
 * //   restricted_cards: 10,
 * //   by_rarity: { champion: 2, legendary: 3, epic: 5, rare: 3, common: 2 }
 * // }
 */
export async function getRestrictionStats(seasonId) {
  if (!seasonId) {
    throw new Error('seasonId is required');
  }

  try {
    const { data, error } = await supabase
      .from('season_card_restriction')
      .select(`
        restriction_id,
        player_id,
        card_id,
        card:card_id (raw_payload)
      `)
      .eq('season_id', seasonId);

    if (error) throw error;

    const restrictions = data || [];
    const playersSet = new Set();
    const cardsSet = new Set();
    const rarityCount = {
      champion: 0,
      legendary: 0,
      epic: 0,
      rare: 0,
      common: 0,
    };

    restrictions.forEach(r => {
      playersSet.add(r.player_id);
      cardsSet.add(r.card_id);
      
      const rarity = (r.card?.raw_payload?.rarity || 'common').toLowerCase();
      if (rarityCount[rarity] !== undefined) {
        rarityCount[rarity]++;
      }
    });

    return {
      total_restrictions: restrictions.length,
      affected_players: playersSet.size,
      restricted_cards: cardsSet.size,
      by_rarity: rarityCount,
    };
  } catch (error) {
    console.error('Error calculating stats:', error);
    throw error;
  }
}

export const restrictionsService = {
  fetchRestrictions,
  createRestriction,
  bulkCreateRestrictions,
  deleteRestriction,
  bulkDeleteRestrictions,
  checkExistingRestrictions,
  subscribeToRestrictions,
  getRestrictionStats,
};
