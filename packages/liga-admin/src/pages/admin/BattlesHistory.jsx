import React, { useEffect, useMemo, useState, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient"; // ajustá si tu path es otro
import { getCardVariantFromEvolutionLevel } from "../../utils/cardParser";

const DEFAULT_BATTLE_CUTOFF_MINUTES = 600;
const QUERY_TIMEOUT_MS = 12000;

function withTimeout(promise, ms, timeoutMessage) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), ms);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
}

function parseTzOffsetToMinutes(offset) {
  if (typeof offset !== "string") return 0;
  const match = offset.trim().match(/^([+-])(\d{2}):(\d{2})$/);
  if (!match) return 0;

  const sign = match[1] === "-" ? -1 : 1;
  const hours = Number(match[2]);
  const minutes = Number(match[3]);
  return sign * ((hours * 60) + minutes);
}

function getBattleGameDateBySeason(battleTime, season) {
  if (!battleTime || !season) return null;

  const battleDate = new Date(battleTime);
  if (Number.isNaN(battleDate.getTime())) return null;

  const tzOffsetMinutes = parseTzOffsetToMinutes(season.battle_cutoff_tz_offset || "+00:00");
  const cutoffMinutes = Number.isFinite(Number(season.battle_cutoff_minutes))
    ? Number(season.battle_cutoff_minutes)
    : DEFAULT_BATTLE_CUTOFF_MINUTES;

  const shifted = new Date(battleDate.getTime() + (tzOffsetMinutes * 60 * 1000));
  shifted.setUTCMinutes(shifted.getUTCMinutes() - cutoffMinutes);

  return shifted.toISOString().split("T")[0];
}

function isBattleWithinSeasonWindow(battleTime, season) {
  if (!battleTime || !season?.duel_start_date || !season?.duel_end_date) return false;

  const gameDate = getBattleGameDateBySeason(battleTime, season);
  if (!gameDate) return false;

  return gameDate >= season.duel_start_date && gameDate <= season.duel_end_date;
}

function resolveBattleSeason(battleTime, seasons) {
  if (!battleTime || !Array.isArray(seasons) || seasons.length === 0) return null;

  const sortedSeasons = [...seasons].sort((a, b) => {
    const ad = a?.duel_start_date || "";
    const bd = b?.duel_start_date || "";
    return bd.localeCompare(ad);
  });

  return sortedSeasons.find(season => isBattleWithinSeasonWindow(battleTime, season)) || null;
}

// Helpers
function fmtDateTime(iso) {
  if (!iso) return { adjusted: "—", original: "—" };
  const original = new Date(iso);
  
  // For display: adjust UTC time to get the "game day"
  // Battles before 09:50 UTC are part of the previous day
  const gameTime = new Date(iso);
  gameTime.setUTCMinutes(gameTime.getUTCMinutes() - 590); // -9h 50min
  
  // Format the game day date (using UTC for the date)
  const year = gameTime.getUTCFullYear();
  const month = String(gameTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(gameTime.getUTCDate()).padStart(2, '0');
  
  // But show the time in local timezone
  const hours = String(original.getHours()).padStart(2, '0');
  const minutes = String(original.getMinutes()).padStart(2, '0');
  const seconds = String(original.getSeconds()).padStart(2, '0');
  
  return {
    adjusted: `${day}/${month}/${year}, ${hours}:${minutes}:${seconds}`,
    original: original.toUTCString()
  };
}

function sameDayRange(from, to) {
  // Game day changes at 09:50 UTC
  // If only "from" is specified: search from that date onwards (no upper limit)
  // If both are specified: search the full range
  if (from && !to) {
    // From date onwards: start at 09:50 UTC on that date, no end limit
    const start = new Date(from + 'T09:50:00.000Z');
    return { start: start.toISOString(), end: null };
  }
  if (!from && to) {
    // Up to date: no start limit, end at next day 09:49:59 UTC
    const end = new Date(to + 'T09:50:00.000Z');
    end.setUTCDate(end.getUTCDate() + 1);
    end.setUTCMilliseconds(end.getUTCMilliseconds() - 1);
    return { start: null, end: end.toISOString() };
  }
  if (from && to) {
    // Full range: from 09:50 UTC to next day of "to" 09:49:59 UTC
    const start = new Date(from + 'T09:50:00.000Z');
    const end = new Date(to + 'T09:50:00.000Z');
    end.setUTCDate(end.getUTCDate() + 1);
    end.setUTCMilliseconds(end.getUTCMilliseconds() - 1);
    return { start: start.toISOString(), end: end.toISOString() };
  }
  return { start: null, end: null };
}


function computeBattleSummary({ battle, rounds, playersById }) {
  // Para 1v1: TEAM vs OPPONENT por crowns totales (si no hay rounds, rounds tiene 1)
  // Para duelos: sumamos rounds ganados por side
  const roundNos = [...new Set(rounds.map(r => r.round_no))].sort((a,b)=>a-b);

  const perRound = roundNos.map((rn) => {
    const rows = rounds.filter(x => x.round_no === rn);

    // rows: [TEAM player(s)] + [OPPONENT player(s)]
    const team = rows.filter(x => x.side === "TEAM");
    const opp = rows.filter(x => x.side === "OPPONENT");

    // In 2v2, both players on the same side have the same crowns value
    // So we just take the first player's crowns from each side
    const teamCrowns = team.length > 0 ? (team[0].crowns ?? 0) : 0;
    // For war duels, opponent crowns are in opponent_crowns field of the TEAM player
    const oppCrowns = team.length > 0 && team[0].opponent_crowns !== null && team[0].opponent_crowns !== undefined 
      ? team[0].opponent_crowns 
      : (opp.length > 0 ? (opp[0].crowns ?? 0) : 0);

    let winner = "DRAW";
    if (teamCrowns > oppCrowns) winner = "TEAM";
    if (oppCrowns > teamCrowns) winner = "OPPONENT";

    return { roundNo: rn, teamCrowns, oppCrowns, winner, team, opp };
  });

  const teamRoundsWon = perRound.filter(r => r.winner === "TEAM").length;
  const oppRoundsWon = perRound.filter(r => r.winner === "OPPONENT").length;

  // Get all unique players from each side
  const teamPlayers = [...new Set(rounds.filter(r => r.side === "TEAM").map(r => r.player_id))];
  const oppPlayers = [...new Set(rounds.filter(r => r.side === "OPPONENT").map(r => r.player_id))];
  
  // Build title for each side
  let titleLeft, titleRight;
  
  // TEAM side
  if (teamPlayers.length > 1) {
    // 2v2: show both players
    const names = teamPlayers.map(pid => {
      const p = playersById[pid];
      return p?.nick || p?.name || "?";
    });
    titleLeft = names.join(" + ");
  } else if (teamPlayers.length === 1) {
    const p = playersById[teamPlayers[0]];
    titleLeft = p?.nick || p?.name || "TEAM";
  } else {
    titleLeft = "TEAM";
  }
  
  // OPPONENT side
  const firstTeam = rounds.find(r => r.side === "TEAM");
  const unregisteredOpponent = firstTeam?.opponent ? (Array.isArray(firstTeam.opponent) ? firstTeam.opponent[0] : firstTeam.opponent) : null;
  
  if (unregisteredOpponent) {
    titleRight = unregisteredOpponent?.name || unregisteredOpponent?.tag || "OPPONENT";
  } else if (oppPlayers.length > 1) {
    // 2v2: show both players
    const names = oppPlayers.map(pid => {
      const p = playersById[pid];
      return p?.nick || p?.name || "?";
    });
    titleRight = names.join(" + ");
  } else if (oppPlayers.length === 1) {
    const p = playersById[oppPlayers[0]];
    titleRight = p?.nick || p?.name || "OPPONENT";
  } else {
    titleRight = "OPPONENT";
  }

  // Resultado "final"
  const finalLeft = battle.round_count > 1 ? teamRoundsWon : perRound.reduce((a,r)=>a+r.teamCrowns,0);
  const finalRight = battle.round_count > 1 ? oppRoundsWon : perRound.reduce((a,r)=>a+r.oppCrowns,0);

  let winner = "DRAW";
  if (finalLeft > finalRight) winner = "LEFT";
  if (finalRight > finalLeft) winner = "RIGHT";

  return {
    titleLeft,
    titleRight,
    finalLeft,
    finalRight,
    winner,
    perRound,
  };
}

async function fetchPlayersIndex() {
  const { data, error } = await supabase
    .from("player")
    .select("player_id,name,nick")
    .order("nick", { ascending: true });
  if (error) throw error;
  return data || [];
}

// Fetch extreme/risky configuration for a player at a specific date
async function fetchPlayerExtremeConfig(playerId, battleDate, battleSeason, seasonExtremeConfigMap) {
  if (!playerId || !battleDate || !battleSeason) return null;

  if (battleSeason.is_extreme_config_disabled) {
    return null;
  }

  const seasonConfigCards = seasonExtremeConfigMap?.[battleSeason.season_id];
  if (!Array.isArray(seasonConfigCards) || seasonConfigCards.length === 0) {
    return null;
  }

  const battleDateStr = getBattleGameDateBySeason(battleDate, battleSeason);
  if (!battleDateStr) {
    return null;
  }
  
  // Check if player was in extreme/risky period
  // Get all participants for this player and filter by date in JS
  const { data: participants, error: e1 } = await supabase
    .from('season_extreme_participant')
    .select('season_id, team_id, participant_type, start_date, end_date')
    .eq('player_id', playerId)
    .eq('season_id', battleSeason.season_id);
    
  if (e1) {
    console.error('Error fetching extreme participants:', e1);
    return null;
  }
  
  if (!participants || participants.length === 0) {
    return null;
  }
  
  // Filter by date in JavaScript
  const participant = participants.find(p => {
    const startDate = p.start_date ? new Date(p.start_date).toISOString().split('T')[0] : null;
    const endDate = p.end_date ? new Date(p.end_date).toISOString().split('T')[0] : null;
    
    const afterStart = !startDate || battleDateStr >= startDate;
    const beforeEnd = !endDate || battleDateStr <= endDate;
    
    return afterStart && beforeEnd;
  });
  
  if (!participant) {
    return null;
  }
  
  return {
    isRisky: participant.participant_type === 'RISKY',
    allowedCardIds: seasonConfigCards
  };
}

// Validate if a deck uses only allowed cards
function validateDeck(deckCards, allowedCardIds) {
  if (!Array.isArray(deckCards) || deckCards.length === 0) return false;
  if (!Array.isArray(allowedCardIds) || allowedCardIds.length === 0) return false;
  
  return deckCards.every(card => allowedCardIds.includes(card.id));
}

// Validate extreme/risky compliance for a war duel
function validateExtremeDuel(perRound, isRisky, allowedCardIds) {
  // perRound contains the rounds with team/opp arrays with deck_cards
  const totalRounds = perRound.length;
  
  // Get all team decks (assuming we're validating for TEAM player)
  const teamDecks = perRound.flatMap(r => 
    (r.team || []).map(t => t.deck_cards).filter(Boolean)
  );
  
  if (teamDecks.length === 0) return { valid: false, message: 'No decks found' };
  
  // Validate each deck
  const validDecks = teamDecks.filter(deck => validateDeck(deck, allowedCardIds));
  
  if (isRisky) {
    // RISKY: 2 rounds (0-2 or 2-0) -> at least 1 deck with cards
    //        3 rounds (1-2 or 2-1) -> at least 2 decks with cards
    const requiredValid = totalRounds === 2 ? 1 : 2;
    const isValid = validDecks.length >= requiredValid;
    return {
      valid: isValid,
      message: `Risky: ${validDecks.length}/${teamDecks.length} mazos válidos (requiere ${requiredValid})`
    };
  } else {
    // EXTREME: 2 rounds -> 2 decks 100% with cards
    //          3 rounds -> 3 decks 100% with cards
    const requiredValid = totalRounds === 2 ? 2 : 3;
    const isValid = validDecks.length >= requiredValid;
    return {
      valid: isValid,
      message: `Extreme: ${validDecks.length}/${teamDecks.length} mazos válidos (requiere ${requiredValid})`
    };
  }
}

// Fetch card restrictions for a player in a season
async function fetchPlayerRestrictionsConfig(playerId, seasonId) {
  if (!playerId || !seasonId) return null;
  
  // Get all card restrictions for this player in this season
  const { data: restrictions, error } = await supabase
    .from('season_card_restriction')
    .select('card_id, restriction_variant')
    .eq('player_id', playerId)
    .eq('season_id', seasonId);
    
  if (error) {
    console.error('Error fetching restrictions:', error);
    return null;
  }
  
  if (!restrictions || restrictions.length === 0) {
    return null;
  }
  
  return {
    restrictions: restrictions.map(r => ({
      card_id: Number(r.card_id),
      restriction_variant: r.restriction_variant || 'normal',
    })),
    restrictedCardIds: restrictions.map(r => Number(r.card_id))
  };
}

// Validate if a deck uses restricted cards
function validateRestrictionCompliance(deckCards, restrictions) {
  if (!Array.isArray(deckCards) || deckCards.length === 0) return false;
  if (!Array.isArray(restrictions) || restrictions.length === 0) return true; // No restrictions = valid
  
  // Check if any card variant in the deck is in the restricted list
  return !deckCards.some(card => {
    const playedVariant = getCardVariantFromEvolutionLevel(card.evolution_level);
    return restrictions.some(restriction => {
      if (Number(restriction.card_id) !== Number(card.id)) {
        return false;
      }

      return restriction.restriction_variant === 'all' || restriction.restriction_variant === playedVariant;
    });
  });
}

// Validate RES compliance for a war duel
function validateRestrictionDuel(perRound, restrictions) {
  // perRound contains the rounds with team/opp arrays with deck_cards
  const totalRounds = perRound.length;
  
  // Get all team decks (assuming we're validating for TEAM player)
  const teamDecks = perRound.flatMap(r => 
    (r.team || []).map(t => t.deck_cards).filter(Boolean)
  );
  
  if (teamDecks.length === 0) return { valid: false, message: 'No decks found' };
  
  // Check if any deck uses restricted cards
  const violatingDecks = teamDecks.filter(deck => !validateRestrictionCompliance(deck, restrictions));
  const validDecks = teamDecks.length - violatingDecks.length;
  
  const isValid = violatingDecks.length === 0;
  return {
    valid: isValid,
    message: `RES: ${validDecks}/${teamDecks.length} mazos válidos${violatingDecks.length > 0 ? ` (${violatingDecks.length} con cartas restringidas)` : ''}`
  };
}


async function fetchDistinctModes() {
  // Trae modos existentes (api_game_mode) para el dropdown.
  // Si está vacío al principio, no pasa nada.
  const { data, error } = await supabase
    .from("battle")
    .select("api_game_mode")
    .not("api_game_mode", "is", null)
    .limit(5000);
  if (error) throw error;
  const modes = Array.from(new Set((data || []).map(x => x.api_game_mode).filter(Boolean)));
  modes.sort();
  return modes;
}

async function fetchScopedAssignments({ seasonId, zoneId, teamId, playerId, selectFields }) {
  let query = supabase
    .from('season_zone_team_player')
    .select(seasonId ? `${selectFields}, season_zone!inner(season_id)` : selectFields);

  if (seasonId) {
    query = query.eq('season_zone.season_id', seasonId);
  }

  if (zoneId) {
    query = query.eq('zone_id', zoneId);
  }

  if (teamId) {
    query = query.eq('team_id', teamId);
  }

  if (playerId) {
    query = query.eq('player_id', playerId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function fetchAllRowsPaged(buildQuery, pageSize = 1000) {
  const rows = [];
  let from = 0;

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await buildQuery(from, to);
    if (error) throw error;

    const chunk = data || [];
    if (chunk.length === 0) {
      break;
    }

    rows.push(...chunk);

    if (chunk.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return rows;
}

async function fetchAllBattles({ fromISO, toISO, mode, zoneId, teamId, seasonId }) {
  // Buscar todas las batallas sin filtro de jugador específico
  const battles = await fetchAllRowsPaged((from, to) => {
    let q = supabase
      .from("battle")
      .select("battle_id,battle_time,api_game_mode")
      .order("battle_time", { ascending: false })
      .range(from, to);

    if (mode) q = q.eq("api_game_mode", mode);
    if (fromISO) q = q.gte("battle_time", fromISO);
    if (toISO) q = q.lte("battle_time", toISO);

    return q;
  });

  let filtered = (battles || []).map(x => x.battle_id);
  
  // If zone/team filters are active, filter by player participation
  if ((zoneId || teamId) && filtered.length > 0) {
    const assignments = await fetchScopedAssignments({
      seasonId,
      zoneId,
      teamId,
      selectFields: 'player_id, start_date, end_date',
    });

    if (!assignments.length) {
      return [];
    }
    
    const playerIds = [...new Set(assignments.map(a => a.player_id))];
    
    // Get battle_round_player records for these players in batches to avoid URL length limits
    const batchSize = 100; // Process 100 records at a time
    const allRoundIds = new Set();
    
    for (let i = 0; i < playerIds.length; i += batchSize) {
      const batchPlayerIds = playerIds.slice(i, i + batchSize);

      const brp = await fetchAllRowsPaged((from, to) => {
        return supabase
          .from('battle_round_player')
          .select('battle_round_id')
          .in('player_id', batchPlayerIds)
          .range(from, to);
      });
      
      (brp || []).forEach(r => allRoundIds.add(r.battle_round_id));
    }
    
    if (allRoundIds.size === 0) return [];
    
    // Get battle_round to map to battle_id in batches
    const roundIdsArray = [...allRoundIds];
    const zoneBattleIds = new Set();
    
    for (let i = 0; i < roundIdsArray.length; i += 500) {
      const batchRoundIds = roundIdsArray.slice(i, i + 500);
      
      const { data: rounds, error: e3 } = await supabase
        .from('battle_round')
        .select('battle_id')
        .in('battle_round_id', batchRoundIds);
      
      if (e3) throw e3;
      
      (rounds || []).forEach(r => zoneBattleIds.add(r.battle_id));
    }
    
    // Filter to only battles where zone/team players participated
    filtered = filtered.filter(id => zoneBattleIds.has(id));
  }
  
  return filtered;
}

async function fetchBattleIdsByPlayer(playerId, { fromISO, toISO, mode, zoneId, teamId, seasonId }) {
  // 1) buscamos batallas donde participó playerId
  // battle_round_player -> battle_round -> battle_id
  const data = await fetchAllRowsPaged((from, to) => {
    return supabase
      .from("battle_round_player")
      .select("battle_round_id, player_id")
      .eq("player_id", playerId)
      .range(from, to);
  });

  const roundIds = (data || []).map(x => x.battle_round_id).filter(Boolean);
  if (!roundIds.length) return [];

  // 2) resolvemos battle_round -> battle_id
  const { data: br, error: e2 } = await supabase
    .from("battle_round")
    .select("battle_round_id,battle_id")
    .in("battle_round_id", roundIds);
  if (e2) throw e2;

  const battleIds = Array.from(new Set((br || []).map(x => x.battle_id).filter(Boolean)));
  if (!battleIds.length) return [];

  // 3) filtramos por battle (mode + date) y devolvemos ids ya filtrados
  let qb = supabase
    .from("battle")
    .select("battle_id,battle_time,api_game_mode")
    .in("battle_id", battleIds)
    .order("battle_time", { ascending: false });

  if (mode) qb = qb.eq("api_game_mode", mode);
  if (fromISO) qb = qb.gte("battle_time", fromISO);
  if (toISO) qb = qb.lte("battle_time", toISO);

  const { data: b, error: e3 } = await qb;
  if (e3) throw e3;

  let filtered = (b || []).map(x => x.battle_id);
  
  // 4) If zone filter is set, check if player was in that zone (and optionally team) during battle time
  if ((zoneId || teamId) && filtered.length > 0) {
    const assignments = await fetchScopedAssignments({
      seasonId,
      zoneId,
      teamId,
      playerId,
      selectFields: 'start_date, end_date',
    });

    if (!assignments.length) {
      return []; // Player was never in this zone/team
    }
    
    // Filter battles by date - only keep battles where player was active in zone/team
    const battlesWithTime = b || [];
    filtered = battlesWithTime.filter(battle => {
      const battleDate = new Date(battle.battle_time);
      battleDate.setHours(0, 0, 0, 0);
      
      return assignments.some(assignment => {
        const startDate = assignment.start_date ? new Date(assignment.start_date) : null;
        const endDate = assignment.end_date ? new Date(assignment.end_date) : null;
        
        if (startDate) startDate.setHours(0, 0, 0, 0);
        if (endDate) endDate.setHours(0, 0, 0, 0);
        
        const afterStart = !startDate || battleDate >= startDate;
        const beforeEnd = !endDate || battleDate <= endDate;
        
        return afterStart && beforeEnd;
      });
    }).map(b => b.battle_id);
  }

  return filtered;
}

async function fetchBattlesWithDetails(battleIds, { page, pageSize }) {
  if (!battleIds.length) return { battles: [], rounds: [], playersById: {} };

  // paginación por ids (client-side): cortamos el array
  const start = page * pageSize;
  const slice = battleIds.slice(start, start + pageSize);

  const { data: battles, error: e1 } = await supabase
    .from("battle")
    .select("battle_id,battle_time,api_battle_type,api_game_mode,team_size,round_count")
    .in("battle_id", slice)
    .order("battle_time", { ascending: false });
  if (e1) throw e1;

  const ids = (battles || []).map(b => b.battle_id);
  if (!ids.length) return { battles: [], rounds: [], playersById: {} };

  // battle_round ids
  const { data: br, error: e2 } = await supabase
    .from("battle_round")
    .select("battle_round_id,battle_id,round_no")
    .in("battle_id", ids);
  if (e2) throw e2;

  const roundIds = (br || []).map(x => x.battle_round_id);
  if (!roundIds.length) return { battles: battles || [], rounds: [], playersById: {} };

  // round players (deck + crowns)
  const { data: rp, error: e3 } = await supabase
    .from("battle_round_player")
    .select("battle_round_id,player_id,side,crowns,deck_cards,elixir_avg,opponent,opponent_crowns")
    .in("battle_round_id", roundIds);
  if (e3) throw e3;

  // players index (solo ids que aparecen)
  const playerIds = Array.from(new Set((rp || []).map(x => x.player_id).filter(Boolean)));
  const playersById = {};
  // Collect card metadata for rendering images
  let cardsById = {};
  if (playerIds.length) {
    const { data: ps, error: e4 } = await supabase
      .from("player")
      .select("player_id,name,nick")
      .in("player_id", playerIds);
    if (e4) throw e4;
    (ps || []).forEach(p => (playersById[p.player_id] = p));
    // Fetch card data for all card IDs that appear in decks
    const cardIds = new Set();
    (rp || []).forEach(record => {
      const cards = Array.isArray(record.deck_cards) ? record.deck_cards : [];
      cards.forEach(c => cardIds.add(c.id));
      // Also collect card IDs from unregistered opponents
      if (record.opponent) {
        const opponents = Array.isArray(record.opponent) ? record.opponent : [record.opponent];
        opponents.forEach(opp => {
          const oppCards = Array.isArray(opp.deck_cards) ? opp.deck_cards : [];
          oppCards.forEach(c => cardIds.add(c.id));
        });
      }
    });

    if (cardIds.size > 0) {
      const { data: cards, error: e5 } = await supabase
        .from("card")
        .select("card_id,raw_payload")
        .in("card_id", Array.from(cardIds));
      if (e5) throw e5;
      (cards || []).forEach(c => {
        cardsById[c.card_id] = c.raw_payload;
      });
    }
  }

  // armamos rounds “flattened” con round_no y battle_id
  const roundNoByRoundId = {};
  const battleIdByRoundId = {};
  (br || []).forEach(r => {
    roundNoByRoundId[r.battle_round_id] = r.round_no;
    battleIdByRoundId[r.battle_round_id] = r.battle_id;
  });

  const rounds = (rp || []).map(x => ({
    ...x,
    round_no: roundNoByRoundId[x.battle_round_id] ?? 1,
    battle_id: battleIdByRoundId[x.battle_round_id],
  }));

  return { battles: battles || [], rounds, playersById, cardsById };
}

export default function BattlesHistory() {
  const [searchParams, setSearchParams] = useSearchParams();

  // filtros (persistidos por querystring)
  const [players, setPlayers] = useState([]);
  const [modes, setModes] = useState([]);
  const [zones, setZones] = useState([]);
  const [teams, setTeams] = useState([]);
  const [activeSeason, setActiveSeason] = useState(null);
  const [seasonsCatalog, setSeasonsCatalog] = useState([]);
  const [seasonExtremeConfigMap, setSeasonExtremeConfigMap] = useState({});
  const [zoneTeamPlayers, setZoneTeamPlayers] = useState([]);

  const playerId = searchParams.get("playerId") || "";
  const mode = searchParams.get("mode") || "";
  const from = searchParams.get("from") || "";
  const to = searchParams.get("to") || "";
  const zoneId = searchParams.get("zoneId") || "";
  const teamId = searchParams.get("teamId") || "";
  const extremeFilter = searchParams.get("extremeFilter") || "all";
  const resFilter = searchParams.get("resFilter") || "all";
  const seasonFilterId = searchParams.get("seasonId") || "";
  const selectedSeasonId = seasonFilterId || activeSeason?.season_id || "";

  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [battleIds, setBattleIds] = useState([]);
  const [page, setPage] = useState(0);
  const pageSize = 12;

  const [battles, setBattles] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [playersById, setPlayersById] = useState({});
  const [expanded, setExpanded] = useState(() => new Set());
  const [cardsById, setCardsById] = useState({});
  const [extremeConfigs, setExtremeConfigs] = useState({}); // { battle_id: { config, validation } }
  const [restrictionConfigs, setRestrictionConfigs] = useState({}); // { battle_id: { config, validation } }

  // Track if we've already auto-defaulted season filter on first load
  const autoDefaultedRef = useRef(false);

  useEffect(() => {
    let subscription = null;
    
    (async () => {
      try {
        const [ps, ms] = await Promise.all([fetchPlayersIndex(), fetchDistinctModes()]);
        setPlayers(ps);
        setModes(ms);
        
        // Load seasons catalog for validation (latest schema fields)
        const { data: seasons, error: seasonError } = await supabase
          .from('season')
          .select('season_id, description, is_extreme_config_disabled, duel_start_date, duel_end_date, battle_cutoff_minutes, battle_cutoff_tz_offset, created_at')
          .order('created_at', { ascending: false })
;
        
        if (!seasonError && seasons && seasons.length > 0) {
          setSeasonsCatalog(seasons);
          const latestSeason = seasons[0];
          setActiveSeason(latestSeason);

          // Load season extreme config map (only seasons with rows should be validated)
          const { data: extremeRows, error: extremeErr } = await supabase
            .from('season_extreme_config')
            .select('season_id, extreme_deck_cards');

          if (!extremeErr && Array.isArray(extremeRows)) {
            const nextExtremeMap = {};
            extremeRows.forEach(row => {
              nextExtremeMap[row.season_id] = Array.isArray(row.extreme_deck_cards)
                ? row.extreme_deck_cards
                : [];
            });
            setSeasonExtremeConfigMap(nextExtremeMap);
          }
          
          // Subscribe to season changes for real-time config updates
          subscription = supabase
            .channel(`season:${latestSeason.season_id}`)
            .on(
              'postgres_changes',
              {
                event: 'UPDATE',
                schema: 'public',
                table: 'season',
                filter: `season_id=eq.${latestSeason.season_id}`,
              },
              (payload) => {
                if (payload.new) {
                  setActiveSeason(prev => prev && prev.season_id === payload.new.season_id
                    ? { ...prev, ...payload.new }
                    : prev);
                  setSeasonsCatalog(prev => prev.map(season =>
                    season.season_id === payload.new.season_id
                      ? { ...season, ...payload.new }
                      : season
                  ));
                }
              }
            )
            .subscribe();
          
        }
      } catch (e) {
        console.error(e);
      }
    })();
    
    // Cleanup subscription on unmount
    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);

  // Load zones for selected season
  useEffect(() => {
    (async () => {
      if (!selectedSeasonId) {
        setZones([]);
        return;
      }

      const { data: zonesData, error: zonesError } = await supabase
        .from('season_zone')
        .select('zone_id, name, zone_order')
        .eq('season_id', selectedSeasonId)
        .order('zone_order');

      if (zonesError) {
        setZones([]);
        return;
      }

      const nextZones = zonesData || [];
      setZones(nextZones);

      if (zoneId && !nextZones.some(z => z.zone_id === zoneId)) {
        const next = new URLSearchParams(searchParams);
        next.delete('zoneId');
        next.delete('teamId');
        next.delete('playerId');
        setSearchParams(next, { replace: true });
      }
    })();
  }, [selectedSeasonId, zoneId, searchParams, setSearchParams]);
  
  // Load teams for the selected season and optional zone scope
  useEffect(() => {
    (async () => {
      if (!selectedSeasonId) {
        setTeams([]);
        return;
      }

      try {
        let teamScopeQuery = supabase
          .from('season_zone_team')
          .select('team_id, team_order, zone_id, season_zone!inner(season_id)')
          .eq('season_zone.season_id', selectedSeasonId)
          .order('team_order');

        if (zoneId) {
          teamScopeQuery = teamScopeQuery.eq('zone_id', zoneId);
        }

        const { data: scopedTeams, error: e1 } = await teamScopeQuery;

        if (e1) {
          setTeams([]);
          return;
        }

        if (!scopedTeams || scopedTeams.length === 0) {
          setTeams([]);
          return;
        }

        const scopedTeamMap = new Map();
        scopedTeams.forEach((team) => {
          if (!team?.team_id || scopedTeamMap.has(team.team_id)) {
            return;
          }
          scopedTeamMap.set(team.team_id, team);
        });

        const teamIds = [...scopedTeamMap.keys()];
        const { data: teamDetails, error: e2 } = await supabase
          .from('team')
          .select('team_id, name')
          .in('team_id', teamIds);

        if (e2) {
          setTeams([]);
          return;
        }

        if (teamDetails) {
          const sortedTeams = teamDetails.slice().sort((left, right) => {
            const leftScope = scopedTeamMap.get(left.team_id);
            const rightScope = scopedTeamMap.get(right.team_id);
            const leftOrder = Number(leftScope?.team_order ?? Number.MAX_SAFE_INTEGER);
            const rightOrder = Number(rightScope?.team_order ?? Number.MAX_SAFE_INTEGER);
            if (leftOrder !== rightOrder) {
              return leftOrder - rightOrder;
            }
            return (left.name || '').localeCompare(right.name || '');
          });
          setTeams(sortedTeams);
        }
      } catch (e) {
        setTeams([]);
      }
    })();
  }, [selectedSeasonId, zoneId]);

  // Default season filter to current (latest) season
  useEffect(() => {
    // Only auto-default on first load when activeSeason becomes available
    if (autoDefaultedRef.current || !activeSeason?.season_id) {
      return;
    }

    // Check if seasonId param already exists (user explicitly set it or we already defaulted)
    if (searchParams.has("seasonId")) {
      autoDefaultedRef.current = true;
      return;
    }

    // Auto-default to current season on first load
    autoDefaultedRef.current = true;
    const next = new URLSearchParams(searchParams);
    next.set("seasonId", activeSeason.season_id);
    setSearchParams(next, { replace: true });
  }, [activeSeason?.season_id, searchParams, setSearchParams]);

  // Load players for the selected season and optional zone/team scope
  useEffect(() => {
    (async () => {
      if (!selectedSeasonId) {
        setZoneTeamPlayers([]);
        return;
      }

      try {
        const assignments = await fetchScopedAssignments({
          seasonId: selectedSeasonId,
          zoneId,
          teamId,
          selectFields: 'player_id',
        });

        if (!assignments || assignments.length === 0) {
          setZoneTeamPlayers([]);
          return;
        }

        // Extract unique player IDs
        const playerIds = [...new Set(assignments.map(a => a.player_id).filter(Boolean))];
        setZoneTeamPlayers(playerIds);
      } catch (e) {
        setZoneTeamPlayers([]);
      }
    })();
  }, [zoneId, teamId, selectedSeasonId]);

  // Filter players based on selected season / zone / team scope
  const filteredPlayers = useMemo(() => {
    if (!selectedSeasonId) {
      return players;
    }
    if (zoneTeamPlayers.length === 0) {
      return [];
    }
    return players.filter(p => zoneTeamPlayers.includes(p.player_id));
  }, [players, selectedSeasonId, zoneTeamPlayers]);

  useEffect(() => {
    if (!teamId) return;
    const stillValid = teams.some((team) => team.team_id === teamId);
    if (stillValid) return;

    const next = new URLSearchParams(searchParams);
    next.delete('teamId');
    next.delete('playerId');
    setSearchParams(next, { replace: true });
  }, [teamId, teams, searchParams, setSearchParams]);

  // Keep player filter valid for current season/zone/team scope
  useEffect(() => {
    if (!playerId) return;
    const stillValid = filteredPlayers.some((p) => p.player_id === playerId);
    if (stillValid) return;

    const next = new URLSearchParams(searchParams);
    next.delete('playerId');
    setSearchParams(next, { replace: true });
  }, [playerId, filteredPlayers, searchParams, setSearchParams]);

  // cuando cambian filtros, recalculamos battleIds y reseteamos paginado
  useEffect(() => {
    (async () => {
      setLoading(true);
      setLoadError("");
      try {
        setPage(0);
        setExpanded(new Set());

        const { start, end } = sameDayRange(from, to);
        let ids = playerId 
          ? await withTimeout(
              fetchBattleIdsByPlayer(playerId, { fromISO: start, toISO: end, mode, zoneId, teamId, seasonId: selectedSeasonId }),
              QUERY_TIMEOUT_MS,
              "fetchBattleIdsByPlayer timeout",
            )
          : await withTimeout(
              fetchAllBattles({ fromISO: start, toISO: end, mode, zoneId, teamId, seasonId: selectedSeasonId }),
              QUERY_TIMEOUT_MS,
              "fetchAllBattles timeout",
            );

        // Apply season filter if selected
        if (seasonFilterId && ids.length > 0 && seasonsCatalog.length > 0) {
          const { data: battleTimes, error } = await supabase
            .from("battle")
            .select("battle_id,battle_time")
            .in("battle_id", ids);

          if (!error && battleTimes) {
            ids = battleTimes
              .filter(battle => {
                const season = resolveBattleSeason(battle.battle_time, seasonsCatalog);
                return season?.season_id === seasonFilterId;
              })
              .map(battle => battle.battle_id);
          }
        }
        
        // Apply extreme/risky filter if needed
        if (extremeFilter !== "all" && ids.length > 0 && seasonsCatalog.length > 0) {
          // Get battle times for filtering
          const { data: battleTimes, error } = await supabase
            .from("battle")
            .select("battle_id,battle_time,api_battle_type,round_count")
            .in("battle_id", ids);
          
          if (!error && battleTimes) {
            const filteredIds = [];
            
            for (const battle of battleTimes) {
              // Only check war duels with multiple rounds
              if (battle.round_count > 1 && (battle.api_battle_type === 'war' || battle.api_battle_type?.startsWith('riverRace'))) {
                // Get rounds for this battle to find participating players
                const { data: br, error: e1 } = await supabase
                  .from("battle_round")
                  .select("battle_round_id")
                  .eq("battle_id", battle.battle_id);
                
                if (e1 || !br || br.length === 0) continue;
                
                const roundIds = br.map(r => r.battle_round_id);
                
                const { data: rp, error: e2 } = await supabase
                  .from("battle_round_player")
                  .select("player_id")
                  .in("battle_round_id", roundIds);
                
                if (e2 || !rp || rp.length === 0) continue;
                
                const playerIds = [...new Set(rp.map(r => r.player_id).filter(Boolean))];
                const battleSeason = resolveBattleSeason(battle.battle_time, seasonsCatalog);
                if (!battleSeason) continue;

                const seasonExtremeCards = seasonExtremeConfigMap[battleSeason.season_id];
                if (battleSeason.is_extreme_config_disabled || !Array.isArray(seasonExtremeCards) || seasonExtremeCards.length === 0) {
                  continue;
                }
                
                // Check if any player in this battle matches the filter
                let matchesFilter = false;
                
                for (const pid of playerIds) {
                  const config = await fetchPlayerExtremeConfig(pid, battle.battle_time, battleSeason, seasonExtremeConfigMap);
                  if (config) {
                    if (extremeFilter === "any") {
                      matchesFilter = true;
                      break;
                    } else if (extremeFilter === "extreme" && !config.isRisky) {
                      matchesFilter = true;
                      break;
                    } else if (extremeFilter === "risky" && config.isRisky) {
                      matchesFilter = true;
                      break;
                    }
                  }
                }
                
                if (matchesFilter) {
                  filteredIds.push(battle.battle_id);
                }
              }
            }
            
            ids = filteredIds;
          }
        }
        
        // Apply RES (card restriction) filter if needed
        if (resFilter === "withRes" && ids.length > 0 && seasonsCatalog.length > 0) {
          const { data: battleTimes, error } = await supabase
            .from("battle")
            .select("battle_id,battle_time,api_battle_type,round_count")
            .in("battle_id", ids);

          if (!error && battleTimes) {
            const eligibleBattles = battleTimes.filter(
              (battle) =>
                battle.round_count > 1 &&
                (battle.api_battle_type === "war" || battle.api_battle_type?.startsWith("riverRace")),
            );

            if (eligibleBattles.length === 0) {
              ids = [];
            } else {
              const eligibleBattleIds = eligibleBattles.map((battle) => battle.battle_id);

              const { data: br, error: brError } = await supabase
                .from("battle_round")
                .select("battle_round_id,battle_id")
                .in("battle_id", eligibleBattleIds);

              if (brError || !br || br.length === 0) {
                ids = [];
              } else {
                const roundIds = br.map((row) => row.battle_round_id);

                const { data: rp, error: rpError } = await supabase
                  .from("battle_round_player")
                  .select("battle_round_id,player_id")
                  .in("battle_round_id", roundIds);

                if (rpError || !rp || rp.length === 0) {
                  ids = [];
                } else {
                  const battleByRoundId = new Map(br.map((row) => [row.battle_round_id, row.battle_id]));
                  const playersByBattleId = new Map();

                  for (const row of rp) {
                    const battleId = battleByRoundId.get(row.battle_round_id);
                    if (!battleId || !row.player_id) continue;
                    if (!playersByBattleId.has(battleId)) {
                      playersByBattleId.set(battleId, new Set());
                    }
                    playersByBattleId.get(battleId).add(row.player_id);
                  }

                  const seasonByBattleId = new Map();
                  const seasonIds = new Set();
                  const allPlayers = new Set();

                  for (const battle of eligibleBattles) {
                    const battleSeason = resolveBattleSeason(battle.battle_time, seasonsCatalog);
                    if (!battleSeason?.season_id) continue;
                    seasonByBattleId.set(battle.battle_id, battleSeason.season_id);
                    seasonIds.add(battleSeason.season_id);

                    const battlePlayers = playersByBattleId.get(battle.battle_id);
                    if (!battlePlayers) continue;
                    for (const pid of battlePlayers) {
                      allPlayers.add(pid);
                    }
                  }

                  if (seasonIds.size === 0 || allPlayers.size === 0) {
                    ids = [];
                  } else {
                    const { data: restrictions, error: restrictionsError } = await supabase
                      .from("season_card_restriction")
                      .select("season_id,player_id")
                      .in("season_id", Array.from(seasonIds))
                      .in("player_id", Array.from(allPlayers));

                    if (restrictionsError || !restrictions || restrictions.length === 0) {
                      ids = [];
                    } else {
                      const restrictedPlayersBySeason = new Map();
                      for (const row of restrictions) {
                        if (!row?.season_id || !row?.player_id) continue;
                        if (!restrictedPlayersBySeason.has(row.season_id)) {
                          restrictedPlayersBySeason.set(row.season_id, new Set());
                        }
                        restrictedPlayersBySeason.get(row.season_id).add(row.player_id);
                      }

                      ids = eligibleBattles
                        .filter((battle) => {
                          const seasonId = seasonByBattleId.get(battle.battle_id);
                          const restrictedPlayers = seasonId ? restrictedPlayersBySeason.get(seasonId) : null;
                          if (!restrictedPlayers || restrictedPlayers.size === 0) return false;

                          if (playerId) {
                            // When a player is selected, "Solo con RES" should apply to that player.
                            return restrictedPlayers.has(playerId);
                          }

                          const battlePlayers = playersByBattleId.get(battle.battle_id);
                          if (!battlePlayers || battlePlayers.size === 0) return false;
                          for (const pid of battlePlayers) {
                            if (restrictedPlayers.has(pid)) return true;
                          }
                          return false;
                        })
                        .map((battle) => battle.battle_id);
                    }
                  }
                }
              }
            }
          }
        }
        
        setBattleIds(ids);
      } catch (e) {
        console.error(e);
        setLoadError("No se pudieron cargar las batallas. Reintentá ajustando los filtros.");
        setBattleIds([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [playerId, mode, from, to, zoneId, teamId, extremeFilter, resFilter, seasonFilterId, selectedSeasonId, seasonsCatalog, seasonExtremeConfigMap]);

  // carga de detalles por página
  useEffect(() => {
    (async () => {
      if (!battleIds.length) {
        setCardsById({});
        setBattles([]);
        setRounds([]);
        setPlayersById({});
        setExtremeConfigs({});
        setRestrictionConfigs({});
        return;
      }
      setLoading(true);
      setLoadError("");
      try {
        const res = await withTimeout(
          fetchBattlesWithDetails(battleIds, { page, pageSize }),
          QUERY_TIMEOUT_MS,
          "fetchBattlesWithDetails timeout",
        );
        setBattles(res.battles);
        setRounds(res.rounds);
        setPlayersById(res.playersById);
        setCardsById(res.cardsById);
        
        // Load extreme/risky configurations for war duels
        const configs = {};
        if (res.battles.length > 0 && seasonsCatalog.length > 0) {
          for (const battle of res.battles) {
            // Only check for war duels (round_count > 1)
            // River Race duels can be: riverRaceDuel, riverRaceDuelColosseum, riverRacePvP
            if (battle.round_count > 1 && (battle.api_battle_type === 'war' || battle.api_battle_type?.startsWith('riverRace'))) {
              const battleSeason = resolveBattleSeason(battle.battle_time, seasonsCatalog);
              if (!battleSeason) continue;

              const seasonExtremeCards = seasonExtremeConfigMap[battleSeason.season_id];
              if (battleSeason.is_extreme_config_disabled || !Array.isArray(seasonExtremeCards) || seasonExtremeCards.length === 0) {
                continue;
              }

              // Get rounds for this battle
              const battleRounds = res.rounds.filter(r => r.battle_id === battle.battle_id);
              const summary = computeBattleSummary({ battle, rounds: battleRounds, playersById: res.playersById });
              
              // Si hay un playerId específico, validamos solo para ese jugador
              if (playerId) {
                const config = await fetchPlayerExtremeConfig(playerId, battle.battle_time, battleSeason, seasonExtremeConfigMap);
                if (config) {
                  const validation = validateExtremeDuel(summary.perRound, config.isRisky, config.allowedCardIds);
                  configs[battle.battle_id] = {
                    config,
                    validation,
                    playerId
                  };
                }
              } else {
                // Si no hay playerId, validamos para todos los jugadores del battle
                const playerIdsInBattle = [...new Set(battleRounds.map(r => r.player_id).filter(Boolean))];
                const validations = {};
                
                for (const pid of playerIdsInBattle) {
                  const config = await fetchPlayerExtremeConfig(pid, battle.battle_time, battleSeason, seasonExtremeConfigMap);
                  if (config) {
                    // Filter summary.perRound to only include rounds where this player participated
                    // We need to filter by checking if the player is in the team array of each round
                    const playerPerRound = summary.perRound.map(round => ({
                      ...round,
                      team: round.team.filter(t => t.player_id === pid),
                      opp: round.opp // keep opponent data unchanged
                    })).filter(round => round.team.length > 0); // only keep rounds where player participated
                    
                    const validation = validateExtremeDuel(playerPerRound, config.isRisky, config.allowedCardIds);
                    validations[pid] = {
                      config,
                      validation
                    };
                  }
                }
                
                if (Object.keys(validations).length > 0) {
                  configs[battle.battle_id] = {
                    multiPlayer: true,
                    validations
                  };
                }
              }
            }
          }
        }
        setExtremeConfigs(configs);
        
        // Load RES (card restriction) configurations for war duels
        const resConfigs = {};
        if (res.battles.length > 0 && seasonsCatalog.length > 0) {
          for (const battle of res.battles) {
            // Only check for war duels (round_count > 1)
            if (battle.round_count > 1 && (battle.api_battle_type === 'war' || battle.api_battle_type?.startsWith('riverRace'))) {
              const battleSeason = resolveBattleSeason(battle.battle_time, seasonsCatalog);
              if (!battleSeason) continue;

              // Get rounds for this battle
              const battleRounds = res.rounds.filter(r => r.battle_id === battle.battle_id);
              const summary = computeBattleSummary({ battle, rounds: battleRounds, playersById: res.playersById });
              
              // Si hay un playerId específico, validamos solo para ese jugador
              if (playerId) {
                const config = await fetchPlayerRestrictionsConfig(playerId, battleSeason.season_id);
                if (config) {
                  const validation = validateRestrictionDuel(summary.perRound, config.restrictions);
                  resConfigs[battle.battle_id] = {
                    config,
                    validation,
                    playerId
                  };
                }
              } else {
                // Si no hay playerId, validamos para todos los jugadores del battle
                const playerIdsInBattle = [...new Set(battleRounds.map(r => r.player_id).filter(Boolean))];
                const validations = {};
                
                for (const pid of playerIdsInBattle) {
                  const config = await fetchPlayerRestrictionsConfig(pid, battleSeason.season_id);
                  if (config) {
                    // Filter summary.perRound to only include rounds where this player participated
                    const playerPerRound = summary.perRound.map(round => ({
                      ...round,
                      team: round.team.filter(t => t.player_id === pid),
                      opp: round.opp // keep opponent data unchanged
                    })).filter(round => round.team.length > 0); // only keep rounds where player participated
                    
                    const validation = validateRestrictionDuel(playerPerRound, config.restrictions);
                    validations[pid] = {
                      config,
                      validation
                    };
                  }
                }
                
                if (Object.keys(validations).length > 0) {
                  resConfigs[battle.battle_id] = {
                    multiPlayer: true,
                    validations
                  };
                }
              }
            }
          }
        }
        setRestrictionConfigs(resConfigs);
      } catch (e) {
        console.error(e);
        setLoadError("No se pudieron cargar los detalles de batallas.");
        setBattles([]);
        setRounds([]);
        setPlayersById({});
      } finally {
        setLoading(false);
      }
    })();
  }, [battleIds, page, playerId, seasonsCatalog, seasonExtremeConfigMap]);

  // Auto-expand battle if battleId parameter is present in URL
  useEffect(() => {
    const battleIdParam = searchParams.get('battleId');
    if (battleIdParam && battles.length > 0) {
      const battleExists = battles.find(b => b.battle_id === battleIdParam);
      if (battleExists) {
        setExpanded(new Set([battleIdParam]));
        // Scroll to the battle after a short delay
        setTimeout(() => {
          const element = document.getElementById(`battle-${battleIdParam}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
      }
    }
  }, [battles, searchParams]);

  const totalPages = useMemo(() => Math.ceil((battleIds.length || 0) / pageSize), [battleIds.length]);

  const onFilter = (key, val) => {
    const next = new URLSearchParams(searchParams);
    if (!val) next.delete(key);
    else next.set(key, val);

    if (key === 'seasonId') {
      next.delete('zoneId');
      next.delete('teamId');
      next.delete('playerId');
    }

    if (key === 'zoneId') {
      next.delete('teamId');
      next.delete('playerId');
    }

    if (key === 'teamId') {
      next.delete('playerId');
    }

    setSearchParams(next, { replace: true });
  };

  const battlesWithSummary = useMemo(() => {
    return (battles || []).map((b) => {
      const r = rounds.filter(x => x.battle_id === b.battle_id);
      const summary = computeBattleSummary({ battle: b, rounds: r, playersById });
      return { battle: b, rounds: r, summary };
    });
  }, [battles, rounds, playersById, cardsById]);

  // Get card image URL from card data
  const getCardImageUrl = (cardId, evolutionLevel) => {
    const cardData = cardsById[cardId];
    if (cardData && cardData.iconUrls) {
      // Evolution level 2: use heroMedium
      if (evolutionLevel === 2 && cardData.iconUrls.heroMedium) {
        return cardData.iconUrls.heroMedium;
      }
      // Evolution level 1: use evolutionMedium
      if (evolutionLevel === 1 && cardData.iconUrls.evolutionMedium) {
        return cardData.iconUrls.evolutionMedium;
      }
      // Otherwise use regular medium image
      if (cardData.iconUrls.medium) {
        return cardData.iconUrls.medium;
      }
    }
    // Fallback to a placeholder if not found
    return null;
  };

  // Calculate display level considering evolution
  const getDisplayLevel = (cardId, battleLevel, evolutionLevel) => {
    if (!battleLevel) return battleLevel;
    const cardData = cardsById[cardId];
    if (!cardData) return battleLevel + (evolutionLevel || 0);
    
    // Formula: battleLevel + (16 - maxLevel) + evolution_level
    const displayLevel = battleLevel + (16 - (cardData.maxLevel || 16)) 
    ;
    return displayLevel;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto w-full max-w-6xl px-4 py-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Histórico de Batallas</h1>
            <p className="text-sm text-white/60">Filtrá por jugador, modo y fechas. Click para ver detalle.</p>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-white/70">Temporada</label>
              <select
                className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm outline-none focus:border-blue-500"
                value={seasonFilterId}
                onChange={(e) => onFilter('seasonId', e.target.value)}
              >
                <option value="">Todas</option>
                {seasonsCatalog.map((season) => (
                  <option key={season.season_id} value={season.season_id}>
                    {season.description || season.season_id}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-white/70">
                Jugador
                {teamId ? ` (${filteredPlayers.length} en equipo)` : zoneId ? ` (${filteredPlayers.length} en zona)` : selectedSeasonId ? ` (${filteredPlayers.length} en temporada)` : ''}
              </label>
              <select
                className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm outline-none focus:border-blue-500"
                value={playerId}
                onChange={(e) => onFilter("playerId", e.target.value)}
              >
                <option value="">
                  {filteredPlayers.length === 0 && selectedSeasonId
                    ? teamId
                      ? 'Sin jugadores en este equipo'
                      : zoneId
                        ? 'Sin jugadores en esta zona'
                        : 'Sin jugadores en esta temporada'
                    : 'Todos los jugadores'}
                </option>
                {filteredPlayers.map((p) => (
                  <option key={p.player_id} value={p.player_id}>
                    {(p.nick || p.name) ?? p.player_id}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-white/70">Modo</label>
              <select
                className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm outline-none focus:border-blue-500"
                value={mode}
                onChange={(e) => onFilter("mode", e.target.value)}
              >
                <option value="">Todos</option>
                {modes.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="mb-1 block text-xs font-medium text-white/70">Extreme/Risky</label>
              <select
                className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm outline-none focus:border-blue-500"
                value={extremeFilter}
                onChange={(e) => onFilter("extremeFilter", e.target.value)}
              >
                <option value="all">Todos</option>
                <option value="extreme">Solo Extreme</option>
                <option value="risky">Solo Risky</option>
                <option value="any">Extreme o Risky</option>
              </select>
            </div>
            
            <div>
              <label className="mb-1 block text-xs font-medium text-white/70">RES</label>
              <select
                className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm outline-none focus:border-blue-500"
                value={resFilter}
                onChange={(e) => onFilter("resFilter", e.target.value)}
              >
                <option value="all">Todos</option>
                <option value="withRes">Solo con RES</option>
              </select>
            </div>
          </div>
          
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4 mt-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-white/70">Zona</label>
              <select
                className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm outline-none focus:border-blue-500"
                value={zoneId}
                onChange={(e) => onFilter('zoneId', e.target.value)}
              >
                <option value="">Todas las zonas</option>
                {zones.map((z) => (
                  <option key={z.zone_id} value={z.zone_id}>{z.name}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="mb-1 block text-xs font-medium text-white/70">Equipo</label>
              <select
                className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm outline-none focus:border-blue-500"
                value={teamId}
                onChange={(e) => onFilter("teamId", e.target.value)}
                disabled={!selectedSeasonId}
              >
                <option value="">Todos los equipos</option>
                {teams.map((t) => (
                  <option key={t.team_id} value={t.team_id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-white/70">Fecha (desde)</label>
              <input
                type="date"
                className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm outline-none focus:border-blue-500"
                value={from}
                onChange={(e) => onFilter("from", e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-white/70">Fecha (hasta)</label>
              <input
                type="date"
                className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm outline-none focus:border-blue-500"
                value={to}
                onChange={(e) => onFilter("to", e.target.value)}
              />
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-white/60">
            <div>
              {playerId ? (
                <span>
                  Resultados: <span className="text-white">{battleIds.length}</span>
                </span>
              ) : (
                <span>Elegí un jugador para cargar batallas.</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 hover:bg-white/10 disabled:opacity-50"
                disabled={page <= 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Prev
              </button>
              <span>
                Página <span className="text-white">{totalPages ? page + 1 : 0}</span> / {totalPages || 0}
              </span>
              <button
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 hover:bg-white/10 disabled:opacity-50"
                disabled={page + 1 >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              >
                Next
              </button>
            </div>
          </div>
        </div>

        {/* List */}
        {loading && (
          <div className="mb-4 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/70">
            Cargando…
          </div>
        )}

        {!loading && loadError && (
          <div className="mb-4 rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-100">
            {loadError}
          </div>
        )}

        {!loading && battleIds.length === 0 && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
            No hay batallas para los filtros seleccionados.
          </div>
        )}

        <div className="space-y-3">
          {battlesWithSummary.map(({ battle, rounds: r, summary }) => {
            const isOpen = expanded.has(battle.battle_id);
            const winnerLeft = summary.winner === "LEFT";
            const winnerRight = summary.winner === "RIGHT";

            return (
              <div
                key={battle.battle_id}
                id={`battle-${battle.battle_id}`}
                className="rounded-2xl border border-white/10 bg-white/5 p-4"
              >
                {/* header */}
                <button
                  className="w-full text-left"
                  onClick={() => {
                    const next = new Set(expanded);
                    if (next.has(battle.battle_id)) next.delete(battle.battle_id);
                    else next.add(battle.battle_id);
                    setExpanded(next);
                  }}
                >
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="rounded-xl bg-slate-900/60 px-3 py-2" title={`UTC: ${fmtDateTime(battle.battle_time).original}`}>
                        <div className="text-xs text-white/60">Fecha</div>
                        <div className="text-sm cursor-help">{fmtDateTime(battle.battle_time).adjusted}</div>
                      </div>

                      <div className="rounded-xl bg-slate-900/60 px-3 py-2">
                        <div className="text-xs text-white/60">Modo</div>
                        <div className="text-sm">{battle.api_game_mode || "—"}</div>
                      </div>

                      <div className="rounded-xl bg-slate-900/60 px-3 py-2">
                        <div className="text-xs text-white/60">Tipo</div>
                        <div className="text-sm flex items-center gap-2">
                          {battle.api_battle_type || "—"}
                          {extremeConfigs[battle.battle_id] && (
                            <span className="flex items-center gap-1">
                              {extremeConfigs[battle.battle_id].multiPlayer ? (
                                // Múltiples jugadores: mostrar resumen de validaciones
                                (() => {
                                  const validations = extremeConfigs[battle.battle_id].validations || {};
                                  const allValid = Object.values(validations).every(v => v.validation.valid);
                                  const someValid = Object.values(validations).some(v => v.validation.valid);
                                  const count = Object.keys(validations).length;
                                  
                                  return (
                                    <>
                                      <span title="Validación Extreme/Risky">🔥</span>
                                      {allValid ? (
                                        <span className="text-blue-400" title={`${count} jugador(es) validado(s)`}>✓</span>
                                      ) : someValid ? (
                                        <span className="text-yellow-400" title="Validación parcial (ver detalle)">⚠</span>
                                      ) : (
                                        <span className="text-red-400" title={`${count} jugador(es) con errores`}>✗</span>
                                      )}
                                    </>
                                  );
                                })()
                              ) : (
                                // Jugador único
                                <>
                                  <span title={extremeConfigs[battle.battle_id].config.isRisky ? "Risky" : "Extreme"}>🔥</span>
                                  {extremeConfigs[battle.battle_id].validation.valid ? (
                                    <span className="text-blue-400" title={extremeConfigs[battle.battle_id].validation.message}>✓</span>
                                  ) : (
                                    <span className="text-red-400" title={extremeConfigs[battle.battle_id].validation.message}>✗</span>
                                  )}
                                </>
                              )}
                            </span>
                          )}
                          {restrictionConfigs[battle.battle_id] && (
                            <span className="flex items-center gap-1">
                              {restrictionConfigs[battle.battle_id].multiPlayer ? (
                                // Múltiples jugadores: mostrar resumen de validaciones
                                (() => {
                                  const validations = restrictionConfigs[battle.battle_id].validations || {};
                                  const allValid = Object.values(validations).every(v => v.validation.valid);
                                  const someValid = Object.values(validations).some(v => v.validation.valid);
                                  const count = Object.keys(validations).length;
                                  
                                  return (
                                    <>
                                      <span title="Validación RES (Restricciones)">🚫</span>
                                      {allValid ? (
                                        <span className="text-blue-400" title={`${count} jugador(es) sin usar cartas restringidas`}>✓</span>
                                      ) : someValid ? (
                                        <span className="text-yellow-400" title="Validación parcial (ver detalle)">⚠</span>
                                      ) : (
                                        <span className="text-red-400" title={`${count} jugador(es) usaron cartas restringidas`}>✗</span>
                                      )}
                                    </>
                                  );
                                })()
                              ) : (
                                // Jugador único
                                <>
                                  <span title="RES (Restricciones)">🚫</span>
                                  {restrictionConfigs[battle.battle_id].validation.valid ? (
                                    <span className="text-blue-400" title={restrictionConfigs[battle.battle_id].validation.message}>✓</span>
                                  ) : (
                                    <span className="text-red-400" title={restrictionConfigs[battle.battle_id].validation.message}>✗</span>
                                  )}
                                </>
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 md:justify-end">
                      <div className="text-right">
                        <div className="text-xs text-white/60">Resultado</div>
                        <div className="text-base font-semibold">
                          <span className={winnerLeft ? "text-emerald-400" : "text-white"}>
                            {summary.titleLeft}
                          </span>
                          <span className="mx-2 text-white/40">vs</span>
                          <span className={winnerRight ? "text-emerald-400" : "text-white"}>
                            {summary.titleRight}
                          </span>
                        </div>
                        <div className="text-sm text-white/80">
                          {summary.finalLeft} - {summary.finalRight}{" "}
                          <span className="text-xs text-white/50">
                            {battle.round_count > 1 ? "(rondas)" : "(coronas)"}
                          </span>
                        </div>
                      </div>

                      <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70">
                        {isOpen ? "Ocultar" : "Ver detalle"}
                      </div>
                    </div>
                  </div>
                </button>

                {/* detail */}
                {isOpen && (
                  <div className="mt-4 border-t border-white/10 pt-4">
                    <div className="text-sm font-semibold">Detalle</div>
                    <div className="mt-3 space-y-3">
                      {summary.perRound.map((rr) => (
                        <div key={rr.roundNo} className="rounded-xl border border-white/10 bg-slate-900/40 p-3">
                          <div className="mb-2 flex items-center justify-between">
                            <div className="text-sm font-medium">Ronda {rr.roundNo}</div>
                            <div className="text-sm text-white/80">
                              <span className="text-white">{rr.teamCrowns}</span>
                              <span className="mx-2 text-white/40">-</span>
                              <span className="text-white">{rr.oppCrowns}</span>
                            </div>
                          </div>

                          {/* TEAM players */}
                          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                              <div className="mb-2 text-xs text-white/60">TEAM</div>
                              {(rr.team || []).map((teamRecord) => {
                                const pl = playersById[teamRecord.player_id];
                                const playerName = pl?.nick || pl?.name || teamRecord.player_id;
                                const playerCards = Array.isArray(teamRecord.deck_cards) ? teamRecord.deck_cards : [];
                                
                                // Check validation for this player if multiPlayer mode
                                const battleConfig = extremeConfigs[battle.battle_id];
                                let playerValidation = null;
                                if (battleConfig?.multiPlayer && battleConfig.validations?.[teamRecord.player_id]) {
                                  playerValidation = battleConfig.validations[teamRecord.player_id];
                                }
                                
                                return (
                                  <div key={teamRecord.player_id} className="mb-3 last:mb-0">
                                    {/* Registered team player */}
                                    <div className="flex items-center justify-between">
                                      <div className="text-sm font-semibold flex items-center gap-2">
                                        {playerName}
                                        {playerValidation && (
                                          <span className="flex items-center gap-1">
                                            <span title={playerValidation.config.isRisky ? "Risky" : "Extreme"}>🔥</span>
                                            {playerValidation.validation.valid ? (
                                              <span className="text-blue-400" title={playerValidation.validation.message}>✓</span>
                                            ) : (
                                              <span className="text-red-400" title={playerValidation.validation.message}>✗</span>
                                            )}
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-xs text-white/70">👑 {teamRecord.crowns ?? 0}</div>
                                    </div>
                                    <div className="mt-2 grid grid-cols-4 gap-2">
                                      {playerCards.slice(0, 8).map((c, idx) => (
                                        <div
                                          key={idx}
                                          className="rounded-lg overflow-hidden border border-white/10 bg-slate-950/40 relative group"
                                          title={`${c.name || "card"} (lvl ${c.level ?? "?"})`}
                                        >
                                          <img
                                            src={getCardImageUrl(c.id, c.evolution_level)}
                                            alt={c.name || "card"}
                                            className="w-full h-full object-contain"
                                            onError={(e) => {
                                              e.target.style.display = "none";
                                              e.target.nextElementSibling.style.display = "block";
                                            }}
                                          />
                                          <div
                                            className="absolute inset-0 hidden w-full h-full bg-slate-950/60 flex items-center justify-center text-center text-[10px] text-white/70 p-1"
                                          >
                                            <span>{c.name || "—"}</span>
                                          </div>
                                          {c.level && (
                                            <div className="absolute top-0 left-0 bg-black/80 rounded-br-md px-1.5 py-0.5 text-[10px] font-bold text-white border-b border-r border-white/20">
                                              {getDisplayLevel(c.id, c.level, c.evolution_level)}
                                            </div>
                                          )}
                                          
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* OPPONENT players */}
                            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                              <div className="mb-2 text-xs text-white/60">OPPONENT</div>
                              {(rr.opp && rr.opp.length > 0) ? (
                                (rr.opp || []).map((oppRecord) => {
                                  const pl = playersById[oppRecord.player_id];
                                  const oppName = pl?.nick || pl?.name || oppRecord.player_id;
                                  const oppCards = Array.isArray(oppRecord.deck_cards) ? oppRecord.deck_cards : [];
                                  
                                  return (
                                    <div key={oppRecord.player_id} className="mb-3 last:mb-0">
                                      <div className="flex items-center justify-between">
                                        <div className="text-sm font-semibold">{oppName}</div>
                                        <div className="text-xs text-white/70">👑 {rr.oppCrowns ?? 0}</div>
                                      </div>
                                      <div className="mt-2 grid grid-cols-4 gap-2">
                                        {oppCards.slice(0, 8).map((c, idx) => (
                                          <div
                                            key={idx}
                                            className="rounded-lg overflow-hidden border border-white/10 bg-slate-950/40 relative group"
                                            title={`${c.name || "card"} (lvl ${c.level ?? "?"})`}
                                          >
                                            {getCardImageUrl(c.id, c.evolution_level) ? (
                                              <img
                                                src={getCardImageUrl(c.id, c.evolution_level)}
                                                alt={c.name || "card"}
                                                className="w-full h-full object-contain"
                                                onError={(e) => {
                                                  e.target.style.display = "none";
                                                  e.target.nextElementSibling.style.display = "block";
                                                }}
                                              />
                                            ) : (
                                              <div className="w-full h-full aspect-square bg-slate-950/60 flex items-center justify-center text-center text-[10px] text-white/70 p-1">
                                                <span>{c.name || "—"}</span>
                                              </div>
                                            )}
                                            <div
                                              className="absolute inset-0 hidden w-full h-full bg-slate-950/60 flex items-center justify-center text-center text-[10px] text-white/70 p-1"
                                            >
                                              <span>{c.name || "—"}</span>
                                            </div>
                                            {c.level && (
                                              <div className="absolute top-0 left-0 bg-black/80 rounded-br-md px-1.5 py-0.5 text-[10px] font-bold text-white border-b border-r border-white/20">
                                                {getDisplayLevel(c.id, c.level, c.evolution_level)}
                                              </div>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                })
                              ) : (
                                // If no registered opponents, show unregistered opponents from TEAM's opponent field
                                (rr.team || []).flatMap((teamRecord) => {
                                  const unregisteredOpponents = teamRecord.opponent ? (Array.isArray(teamRecord.opponent) ? teamRecord.opponent : [teamRecord.opponent]) : [];
                                  return unregisteredOpponents.map((opp, idx) => {
                                    const oppName = opp.name || opp.tag || "Unknown";
                                    const oppCards = Array.isArray(opp.deck_cards) ? opp.deck_cards : [];
                                    return (
                                      <div key={`unreg-opp-${idx}`} className="mb-3 last:mb-0">
                                        <div className="flex items-center justify-between">
                                          <div className="text-sm font-semibold text-white/80">{oppName}</div>
                                          <div className="text-xs text-white/70">👑 {rr.oppCrowns ?? 0}</div>
                                        </div>
                                        <div className="text-xs text-white/50 mb-2">(No registrado)</div>
                                        <div className="grid grid-cols-4 gap-2">
                                          {oppCards.slice(0, 8).map((c, cidx) => (
                                            <div
                                              key={cidx}
                                              className="rounded-lg overflow-hidden border border-white/10 bg-slate-950/40 relative group"
                                              title={`${c.name || "card"} (lvl ${c.level ?? "?"})`}
                                            >
                                              {getCardImageUrl(c.id, c.evolution_level) ? (
                                                <img
                                                  src={getCardImageUrl(c.id, c.evolution_level)}
                                                  alt={c.name || "card"}
                                                  className="w-full h-full object-contain"
                                                  onError={(e) => {
                                                    e.target.style.display = "none";
                                                    e.target.nextElementSibling.style.display = "block";
                                                  }}
                                                />
                                              ) : (
                                                <div className="w-full h-full aspect-square bg-slate-950/60 flex items-center justify-center text-center text-[10px] text-white/70 p-1">
                                                  <span>{c.name || "—"}</span>
                                                </div>
                                              )}
                                              {c.level && (
                                                <div className="absolute top-0 left-0 bg-black/80 rounded-br-md px-1.5 py-0.5 text-[10px] font-bold text-white border-b border-r border-white/20">
                                                  {getDisplayLevel(c.id, c.level, c.evolution_level)}
                                                </div>
                                              )}
                                              
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    );
                                  });
                                })
                              )}
                              {(!rr.opp || rr.opp.length === 0) && (!rr.team || rr.team.every(t => !t.opponent)) && (
                                <div className="text-xs text-white/50">Sin datos de oponente</div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-3 text-xs text-white/50">
                      Battle ID: {battle.battle_id}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
