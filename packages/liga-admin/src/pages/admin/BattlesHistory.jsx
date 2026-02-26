import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient"; // ajustá si tu path es otro

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
async function fetchPlayerExtremeConfig(playerId, battleDate) {
  if (!playerId || !battleDate) return null;
  
  // Use the same game day logic as the rest of the app
  // Game day changes at 09:50 UTC, so battles before 09:50 are part of the previous day
  const gameTime = new Date(battleDate);
  gameTime.setUTCMinutes(gameTime.getUTCMinutes() - 590); // -9h 50min
  
  const battleDateStr = gameTime.toISOString().split('T')[0];
  
  // Check if player was in extreme/risky period
  // Get all participants for this player and filter by date in JS
  const { data: participants, error: e1 } = await supabase
    .from('season_extreme_participant')
    .select('season_id, team_id, participant_type, start_date, end_date')
    .eq('player_id', playerId);
    
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
  
  // Get the season's extreme configuration (allowed cards for this season)
  const { data: config, error: e2 } = await supabase
    .from('season_extreme_config')
    .select('extreme_deck_cards')
    .eq('season_id', participant.season_id)
    .single();
    
  if (e2 || !config) {
    return null;
  }
  
  return {
    isRisky: participant.participant_type === 'RISKY',
    allowedCardIds: Array.isArray(config.extreme_deck_cards) ? config.extreme_deck_cards : []
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

async function fetchAllBattles({ fromISO, toISO, mode, zoneId, teamId }) {
  // Buscar todas las batallas sin filtro de jugador específico
  let q = supabase
    .from("battle")
    .select("battle_id,battle_time,api_game_mode")
    .order("battle_time", { ascending: false })
    .limit(1000); // límite para evitar cargas enormes

  if (mode) q = q.eq("api_game_mode", mode);
  if (fromISO) q = q.gte("battle_time", fromISO);
  if (toISO) q = q.lte("battle_time", toISO);

  const { data: battles, error } = await q;
  if (error) throw error;

  let filtered = (battles || []).map(x => x.battle_id);
  
  // If zone/team filters are active, filter by player participation
  if (zoneId && filtered.length > 0) {
    // Build query to get player assignments in the selected zone (and optionally team)
    let assignmentQuery = supabase
      .from('season_zone_team_player')
      .select('player_id, start_date, end_date')
      .eq('zone_id', zoneId);
    
    if (teamId) {
      assignmentQuery = assignmentQuery.eq('team_id', teamId);
    }
    
    const { data: assignments, error: e1 } = await assignmentQuery;
    
    if (e1 || !assignments || assignments.length === 0) {
      return [];
    }
    
    const playerIds = [...new Set(assignments.map(a => a.player_id))];
    
    // Get battle_round_player records for these players in batches to avoid URL length limits
    const batchSize = 100; // Process 100 records at a time
    const allRoundIds = new Set();
    
    for (let i = 0; i < playerIds.length; i += batchSize) {
      const batchPlayerIds = playerIds.slice(i, i + batchSize);
      
      const { data: brp, error: e2 } = await supabase
        .from('battle_round_player')
        .select('battle_round_id')
        .in('player_id', batchPlayerIds)
        .limit(5000);
      
      if (e2) throw e2;
      
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

async function fetchBattleIdsByPlayer(playerId, { fromISO, toISO, mode, zoneId, teamId }) {
  // 1) buscamos batallas donde participó playerId
  // battle_round_player -> battle_round -> battle_id
  let q = supabase
    .from("battle_round_player")
    .select("battle_round_id, player_id")
    .eq("player_id", playerId)
    .limit(5000);

  // No podemos filtrar por battle_time acá sin join embebido, así que filtramos luego con battle.
  const { data, error } = await q;
  if (error) throw error;

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
  if (zoneId && filtered.length > 0) {
    // Build query to get player's assignment periods
    let assignmentQuery = supabase
      .from('season_zone_team_player')
      .select('start_date, end_date')
      .eq('player_id', playerId)
      .eq('zone_id', zoneId);
    
    if (teamId) {
      assignmentQuery = assignmentQuery.eq('team_id', teamId);
    }
    
    const { data: assignments, error: e4 } = await assignmentQuery;
    
    if (e4 || !assignments || assignments.length === 0) {
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
  const [zoneTeamPlayers, setZoneTeamPlayers] = useState([]);

  const playerId = searchParams.get("playerId") || "";
  const mode = searchParams.get("mode") || "";
  const from = searchParams.get("from") || "";
  const to = searchParams.get("to") || "";
  const zoneId = searchParams.get("zoneId") || "";
  const teamId = searchParams.get("teamId") || "";
  const extremeFilter = searchParams.get("extremeFilter") || "all";

  const [loading, setLoading] = useState(false);
  const [battleIds, setBattleIds] = useState([]);
  const [page, setPage] = useState(0);
  const pageSize = 12;

  const [battles, setBattles] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [playersById, setPlayersById] = useState({});
  const [expanded, setExpanded] = useState(() => new Set());
  const [cardsById, setCardsById] = useState({});
  const [extremeConfigs, setExtremeConfigs] = useState({}); // { battle_id: { config, validation } }
  const [isExtremeConfigDisabled, setIsExtremeConfigDisabled] = useState(false); // Flag to disable extreme validation

  useEffect(() => {
    (async () => {
      try {
        const [ps, ms] = await Promise.all([fetchPlayersIndex(), fetchDistinctModes()]);
        setPlayers(ps);
        setModes(ms);
        
        // Load most recent season (instead of filtering by is_active which may not exist)
        const { data: seasons, error: seasonError } = await supabase
          .from('season')
          .select('season_id, description, is_extreme_config_disabled')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (!seasonError && seasons) {
          setActiveSeason(seasons);
          
          // Load extreme config disable flag
          setIsExtremeConfigDisabled(seasons.is_extreme_config_disabled || false);
          
          // Subscribe to season changes for real-time config updates
          const subscription = supabase
            .channel(`season:${seasons.season_id}`)
            .on(
              'postgres_changes',
              {
                event: 'UPDATE',
                schema: 'public',
                table: 'season',
                filter: `season_id=eq.${seasons.season_id}`,
              },
              (payload) => {
                if (payload.new && typeof payload.new.is_extreme_config_disabled === 'boolean') {
                  setIsExtremeConfigDisabled(payload.new.is_extreme_config_disabled);
                }
              }
            )
            .subscribe();
          
          // Load zones for active season
          const { data: zonesData, error: zonesError } = await supabase
            .from('season_zone')
            .select('zone_id, name, zone_order')
            .eq('season_id', seasons.season_id)
            .order('zone_order');
          
          if (!zonesError && zonesData && zonesData.length > 0) {
            setZones(zonesData);
          }
          
          // Cleanup subscription on unmount
          return () => {
            subscription.unsubscribe();
          };
        }
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);
  
  // Load teams when zone changes
  useEffect(() => {
    (async () => {
      if (!zoneId) {
        setTeams([]);
        return;
      }
      
      try {
        console.log('Loading teams for zone:', zoneId);
        
        // Get teams in this zone
        const { data: zoneTeams, error: e1 } = await supabase
          .from('season_zone_team')
          .select('team_id, team_order')
          .eq('zone_id', zoneId)
          .order('team_order');
        
        console.log('Zone teams result:', { zoneTeams, error: e1 });
        
        if (e1) {
          console.error('Error loading zone teams:', e1);
          setTeams([]);
          return;
        }
        
        if (!zoneTeams || zoneTeams.length === 0) {
          console.log('No teams found for this zone');
          setTeams([]);
          return;
        }
        
        const teamIds = zoneTeams.map(t => t.team_id);
        console.log('Team IDs:', teamIds);
        
        // Get team details
        const { data: teamDetails, error: e2 } = await supabase
          .from('team')
          .select('team_id, name')
          .in('team_id', teamIds);
        
        console.log('Team details result:', { teamDetails, error: e2 });
        
        if (e2) {
          console.error('Error loading team details:', e2);
          setTeams([]);
          return;
        }
        
        if (teamDetails) {
          console.log('Setting teams:', teamDetails);
          setTeams(teamDetails);
        }
      } catch (e) {
        console.error('Exception loading teams:', e);
        setTeams([]);
      }
    })();
  }, [zoneId]);

  // Load players when zone changes - filter by zone team player assignments
  useEffect(() => {
    (async () => {
      if (!zoneId) {
        setZoneTeamPlayers([]);
        return;
      }
      
      try {
        console.log('Loading players for zone:', zoneId);
        
        // Get player assignments for this zone
        // Filter by active assignments (start_date <= today, end_date >= today or null)
        const today = new Date().toISOString().split('T')[0];
        
        let query = supabase
          .from('season_zone_team_player')
          .select('player_id, start_date, end_date')
          .eq('zone_id', zoneId);
        
        // Filter for active assignments
        query = query.or(`end_date.is.null,end_date.gte.${today}`);
        query = query.lte('start_date', today);
        
        const { data: assignments, error } = await query;
        
        console.log('Zone player assignments result:', { assignments, error });
        
        if (error) {
          console.error('Error loading zone players:', error);
          setZoneTeamPlayers([]);
          return;
        }
        
        if (!assignments || assignments.length === 0) {
          console.log('No players found for this zone');
          setZoneTeamPlayers([]);
          return;
        }
        
        // Extract unique player IDs
        const playerIds = [...new Set(assignments.map(a => a.player_id).filter(Boolean))];
        console.log('Zone player IDs:', playerIds);
        
        setZoneTeamPlayers(playerIds);
      } catch (e) {
        console.error('Exception loading zone players:', e);
        setZoneTeamPlayers([]);
      }
    })();
  }, [zoneId]);

  // Filter players based on selected zone
  const filteredPlayers = useMemo(() => {
    if (!zoneId || zoneTeamPlayers.length === 0) {
      // No zone selected or no players in zone: show all players
      return players;
    }
    // Zone selected: show only players in that zone
    return players.filter(p => zoneTeamPlayers.includes(p.player_id));
  }, [players, zoneId, zoneTeamPlayers]);

  // cuando cambian filtros, recalculamos battleIds y reseteamos paginado
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        setPage(0);
        setExpanded(new Set());

        const { start, end } = sameDayRange(from, to);
        let ids = playerId 
          ? await fetchBattleIdsByPlayer(playerId, { fromISO: start, toISO: end, mode, zoneId, teamId })
          : await fetchAllBattles({ fromISO: start, toISO: end, mode, zoneId, teamId });
        
        // Apply extreme/risky filter if needed
        if (extremeFilter !== "all" && ids.length > 0) {
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
                
                // Check if any player in this battle matches the filter
                let matchesFilter = false;
                
                for (const pid of playerIds) {
                  const config = await fetchPlayerExtremeConfig(pid, battle.battle_time);
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
        
        setBattleIds(ids);
      } catch (e) {
        console.error(e);
        setBattleIds([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [playerId, mode, from, to, zoneId, teamId, extremeFilter]);

  // carga de detalles por página
  useEffect(() => {
    (async () => {
      if (!battleIds.length) {
        setCardsById({});
        setBattles([]);
        setRounds([]);
        setPlayersById({});
        setExtremeConfigs({});
        return;
      }
      setLoading(true);
      try {
        const res = await fetchBattlesWithDetails(battleIds, { page, pageSize });
        setBattles(res.battles);
        setRounds(res.rounds);
        setPlayersById(res.playersById);
        setCardsById(res.cardsById);
        
        // Load extreme/risky configurations for war duels
        const configs = {};
        // Skip loading configs if extreme configuration is disabled for the season
        if (res.battles.length > 0 && !isExtremeConfigDisabled) {
          for (const battle of res.battles) {
            // Only check for war duels (round_count > 1)
            // River Race duels can be: riverRaceDuel, riverRaceDuelColosseum, riverRacePvP
            if (battle.round_count > 1 && (battle.api_battle_type === 'war' || battle.api_battle_type?.startsWith('riverRace'))) {
              // Get rounds for this battle
              const battleRounds = res.rounds.filter(r => r.battle_id === battle.battle_id);
              const summary = computeBattleSummary({ battle, rounds: battleRounds, playersById: res.playersById });
              
              // Si hay un playerId específico, validamos solo para ese jugador
              if (playerId) {
                const config = await fetchPlayerExtremeConfig(playerId, battle.battle_time);
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
                  const config = await fetchPlayerExtremeConfig(pid, battle.battle_time);
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
      } catch (e) {
        console.error(e);
        setBattles([]);
        setRounds([]);
        setPlayersById({});
      } finally {
        setLoading(false);
      }
    })();
  }, [battleIds, page, playerId, isExtremeConfigDisabled]);

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
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-white/70">
                Jugador{zoneId && zoneTeamPlayers.length > 0 ? ` (${filteredPlayers.length} en zona)` : ''}
              </label>
              <select
                className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm outline-none focus:border-blue-500"
                value={playerId}
                onChange={(e) => onFilter("playerId", e.target.value)}
              >
                <option value="">{zoneId && filteredPlayers.length === 0 ? 'Sin jugadores en esta zona' : 'Todos los jugadores'}</option>
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
          </div>
          
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4 mt-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-white/70">Zona</label>
              <select
                className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm outline-none focus:border-blue-500"
                value={zoneId}
                onChange={(e) => {
                  const next = new URLSearchParams(searchParams);
                  if (!e.target.value) {
                    next.delete("zoneId");
                    next.delete("teamId");
                  } else {
                    next.set("zoneId", e.target.value);
                    next.delete("teamId"); // Reset team when zone changes
                  }
                  setSearchParams(next, { replace: true });
                }}
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
                disabled={!zoneId}
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
