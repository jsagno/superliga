import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ScheduledMatchEditModal from "../../components/ScheduledMatchEditModal";
import { supabase } from "../../lib/supabaseClient";

// Helper functions from BattlesHistory
function fmtDateTime(iso) {
  if (!iso) return { adjusted: "—", original: "—" };
  const original = new Date(iso);
  
  const gameTime = new Date(iso);
  gameTime.setUTCMinutes(gameTime.getUTCMinutes() - 590); // -9h 50min
  
  const year = gameTime.getUTCFullYear();
  const month = String(gameTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(gameTime.getUTCDate()).padStart(2, '0');
  
  const hours = String(original.getHours()).padStart(2, '0');
  const minutes = String(original.getMinutes()).padStart(2, '0');
  const seconds = String(original.getSeconds()).padStart(2, '0');
  
  return {
    adjusted: `${day}/${month}/${year}, ${hours}:${minutes}:${seconds}`,
    original: original.toUTCString()
  };
}

function computeBattleSummary({ battle, rounds, playersById, playerAId, playerBId }) {
  const roundNos = [...new Set(rounds.map(r => r.round_no))].sort((a,b)=>a-b);

  const perRound = roundNos.map((rn) => {
    const rows = rounds.filter(x => x.round_no === rn);
    const team = rows.filter(x => x.side === "TEAM");
    const opp = rows.filter(x => x.side === "OPPONENT");

    const teamCrowns = team.reduce((acc, r) => acc + (r.crowns ?? 0), 0);
    const oppCrowns = team.reduce((acc, r) => acc + (r.opponent_crowns ?? 0), 0) + 
                      opp.reduce((acc, r) => acc + (r.crowns ?? 0), 0);

    let winner = "DRAW";
    if (teamCrowns > oppCrowns) winner = "TEAM";
    if (oppCrowns > teamCrowns) winner = "OPPONENT";

    return { roundNo: rn, teamCrowns, oppCrowns, winner, team, opp };
  });

  const teamRoundsWon = perRound.filter(r => r.winner === "TEAM").length;
  const oppRoundsWon = perRound.filter(r => r.winner === "OPPONENT").length;

  // Find which player is on TEAM side
  const firstTeam = rounds.find(r => r.side === "TEAM");
  const teamPlayerId = firstTeam?.player_id;
  
  // Determine if playerA or playerB is on TEAM side
  let titleLeft, titleRight, finalLeft, finalRight;
  
  if (teamPlayerId === playerAId) {
    // PlayerA is TEAM
    titleLeft = playersById[playerAId]?.nick || playersById[playerAId]?.name || "Player A";
    // PlayerB could be registered opponent or in opponent field
    const registeredOpp = rounds.find(r => r.side === "OPPONENT" && r.player_id === playerBId);
    const unregisteredOpp = firstTeam?.opponent ? (Array.isArray(firstTeam.opponent) ? firstTeam.opponent[0] : firstTeam.opponent) : null;
    titleRight = registeredOpp ? (playersById[playerBId]?.nick || playersById[playerBId]?.name) : (unregisteredOpp?.name || unregisteredOpp?.tag || "Player B");
    
    finalLeft = battle.round_count > 1 ? teamRoundsWon : perRound.reduce((a,r)=>a+r.teamCrowns,0);
    finalRight = battle.round_count > 1 ? oppRoundsWon : perRound.reduce((a,r)=>a+r.oppCrowns,0);
  } else if (teamPlayerId === playerBId) {
    // PlayerB is TEAM
    titleRight = playersById[playerBId]?.nick || playersById[playerBId]?.name || "Player B";
    // PlayerA could be registered opponent or in opponent field
    const registeredOpp = rounds.find(r => r.side === "OPPONENT" && r.player_id === playerAId);
    const unregisteredOpp = firstTeam?.opponent ? (Array.isArray(firstTeam.opponent) ? firstTeam.opponent[0] : firstTeam.opponent) : null;
    titleLeft = registeredOpp ? (playersById[playerAId]?.nick || playersById[playerAId]?.name) : (unregisteredOpp?.name || unregisteredOpp?.tag || "Player A");
    
    // Swap scores because playerB is on TEAM side
    finalLeft = battle.round_count > 1 ? oppRoundsWon : perRound.reduce((a,r)=>a+r.oppCrowns,0);
    finalRight = battle.round_count > 1 ? teamRoundsWon : perRound.reduce((a,r)=>a+r.teamCrowns,0);
  } else {
    // Fallback
    const p1 = playersById[teamPlayerId];
    const firstOpp = rounds.find(r => r.side === "OPPONENT");
    const p2 = firstOpp ? playersById[firstOpp.player_id] : null;
    const unregisteredOpponent = firstTeam?.opponent ? (Array.isArray(firstTeam.opponent) ? firstTeam.opponent[0] : firstTeam.opponent) : null;

    titleLeft = p1?.nick || p1?.name || "TEAM";
    titleRight = unregisteredOpponent?.name || unregisteredOpponent?.tag || p2?.nick || p2?.name || "OPPONENT";
    finalLeft = battle.round_count > 1 ? teamRoundsWon : perRound.reduce((a,r)=>a+r.teamCrowns,0);
    finalRight = battle.round_count > 1 ? oppRoundsWon : perRound.reduce((a,r)=>a+r.oppCrowns,0);
  }

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

export default function GroupStandings() {
  const navigate = useNavigate();
  const { seasonId: seasonParam } = useParams();
  const seasonId = seasonParam || "";

  const [seasons, setSeasons] = useState([]);
  const [zones, setZones] = useState([]);
  const [competitions, setCompetitions] = useState([]);
  const [stages, setStages] = useState([]);
  const [groups, setGroups] = useState([]);
  
  const [selectedZoneId, setSelectedZoneId] = useState("");
  const [selectedCompetitionId, setSelectedCompetitionId] = useState("");
  const [selectedStageId, setSelectedStageId] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  
  const [standings, setStandings] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const [viewBattlesModal, setViewBattlesModal] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [battlesData, setBattlesData] = useState([]);
  const [expandedBattles, setExpandedBattles] = useState(new Set());
  const [cardsById, setCardsById] = useState({});
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedMatchForEdit, setSelectedMatchForEdit] = useState(null);
  const [showShareModal, setShowShareModal] = useState(false);

  // Load seasons
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("season")
        .select("season_id, description")
        .order("created_at", { ascending: false });
      setSeasons(data || []);
    })();
  }, []);

  // Load zones when season changes
  useEffect(() => {
    if (!seasonId) {
      setZones([]);
      setSelectedZoneId("");
      return;
    }

    (async () => {
      const { data } = await supabase
        .from("season_zone")
        .select("zone_id, name, zone_order")
        .eq("season_id", seasonId)
        .order("zone_order", { ascending: true });
      
      setZones(data || []);
      if (data && data.length > 0) {
        setSelectedZoneId(data[0].zone_id);
      }
    })();
  }, [seasonId]);

  // Load competitions when zone changes
  useEffect(() => {
    if (!selectedZoneId) {
      setCompetitions([]);
      setSelectedCompetitionId("");
      return;
    }

    (async () => {
      const { data } = await supabase
        .from("competition")
        .select("competition_id, name")
        .order("name", { ascending: true });
      
      setCompetitions(data || []);
      if (data && data.length > 0) {
        setSelectedCompetitionId(data[0].competition_id);
      }
    })();
  }, [selectedZoneId]);

  // Load stages when competition changes
  useEffect(() => {
    if (!selectedCompetitionId) {
      setStages([]);
      setSelectedStageId("");
      return;
    }

    (async () => {
      const { data: stageData } = await supabase
        .from("competition_stage")
        .select("competition_stage_id, stage")
        .eq("competition_id", selectedCompetitionId)
        .order("stage_order", { ascending: true });

      setStages(stageData || []);
      
      // Auto-select CUP_GROUP stage if available
      if (stageData && stageData.length > 0) {
        const cupGroupStage = stageData.find(s => s.stage === "CUP_GROUP");
        if (cupGroupStage) {
          setSelectedStageId(cupGroupStage.competition_stage_id);
        } else {
          setSelectedStageId(stageData[0].competition_stage_id);
        }
      }
    })();
  }, [selectedCompetitionId]);

  // Load groups when stage changes
  useEffect(() => {
    if (!selectedStageId) {
      setGroups([]);
      setSelectedGroupId("");
      return;
    }

    (async () => {
      const { data } = await supabase
        .from("competition_group")
        .select("competition_group_id, code, name, competition_stage_id")
        .eq("competition_stage_id", selectedStageId)
        .order("code", { ascending: true });
      
      setGroups(data || []);
      if (data && data.length > 0) {
        setSelectedGroupId(data[0].competition_group_id);
      }
    })();
  }, [selectedStageId]);

  // Calculate standings when filters change
  useEffect(() => {
    if (!seasonId || !selectedZoneId || !selectedCompetitionId || !selectedStageId || !selectedGroupId) {
      setStandings([]);
      return;
    }

    calculateStandings();
  }, [seasonId, selectedZoneId, selectedCompetitionId, selectedStageId, selectedGroupId]);

  async function calculateStandings() {
    setLoading(true);

    try {
      // Get all matches for this group
      const { data: matchesData } = await supabase
        .from("scheduled_match")
        .select(`
          scheduled_match_id,
          player_a_id,
          player_b_id,
          score_a,
          score_b,
          scheduled_from,
          status,
          player_a:player!scheduled_match_player_a_id_fkey (player_id, name, nick),
          player_b:player!scheduled_match_player_b_id_fkey (player_id, name, nick)
        `)
        .eq("season_id", seasonId)
        .eq("zone_id", selectedZoneId)
        .eq("competition_id", selectedCompetitionId)
        .eq("competition_group_id", selectedGroupId)
        .order("scheduled_from", { ascending: true });

      // Get player team assignments for this zone to fetch team logos
      const allPlayerIds = [];
      (matchesData || []).forEach(m => {
        if (m.player_a_id) allPlayerIds.push(m.player_a_id);
        if (m.player_b_id) allPlayerIds.push(m.player_b_id);
      });

      const uniquePlayerIds = [...new Set(allPlayerIds)];
      const { data: playerTeams } = await supabase
        .from("season_zone_team_player")
        .select("player_id, team_id, ranking_seed")
        .eq("zone_id", selectedZoneId)
        .in("player_id", uniquePlayerIds);

      const teamIds = [...new Set((playerTeams || []).map(pt => pt.team_id).filter(Boolean))];
      const { data: teams } = await supabase
        .from("team")
        .select("team_id, name, logo")
        .in("team_id", teamIds);

      const playerTeamMap = {};
      const playerRankingMap = {};
      (playerTeams || []).forEach(pt => {
        const team = (teams || []).find(t => t.team_id === pt.team_id);
        playerTeamMap[pt.player_id] = team;
        playerRankingMap[pt.player_id] = pt.ranking_seed;
      });

      // Store all matches for display
      setMatches(matchesData || []);

      // Initialize all players from ALL matches (not just completed ones)
      const playerStats = {};
      
      // First, initialize all players who have matches in this group
      (matchesData || []).forEach(match => {
        if (match.player_a_id && !playerStats[match.player_a_id]) {
          playerStats[match.player_a_id] = {
            player_id: match.player_a_id,
            name: match.player_a?.nick || match.player_a?.name || "Player A",
            played: 0,
            won: 0,
            lost: 0,
            battlesWon: 0,
            battlesLost: 0,
            points: 0,
            team: playerTeamMap[match.player_a_id] || null,
            ranking_seed: playerRankingMap[match.player_a_id] || null
          };
        }
        
        if (match.player_b_id && !playerStats[match.player_b_id]) {
          playerStats[match.player_b_id] = {
            player_id: match.player_b_id,
            name: match.player_b?.nick || match.player_b?.name || "Player B",
            played: 0,
            won: 0,
            lost: 0,
            battlesWon: 0,
            battlesLost: 0,
            points: 0,
            team: playerTeamMap[match.player_b_id] || null,
            ranking_seed: playerRankingMap[match.player_b_id] || null
          };
        }
      });

      // Filter only completed matches for standings calculation
      const completedMatches = (matchesData || []).filter(m => m.score_a !== null && m.score_b !== null);

      // If there are completed matches, get results with points
      if (completedMatches.length > 0) {
        const matchIds = completedMatches.map(m => m.scheduled_match_id);
        const { data: results } = await supabase
          .from("scheduled_match_result")
          .select("scheduled_match_id, final_score_a, final_score_b, points_a, points_b")
          .in("scheduled_match_id", matchIds);

        const resultsMap = {};
        (results || []).forEach(r => {
          resultsMap[r.scheduled_match_id] = r;
        });

        // Update stats for completed matches
        completedMatches.forEach(match => {
          const playerAId = match.player_a_id;
          const playerBId = match.player_b_id;
          const result = resultsMap[match.scheduled_match_id];

          // Update stats (players already initialized above)
          if (playerStats[playerAId]) {
            playerStats[playerAId].played++;
            const scoreA = match.score_a || 0;
            const scoreB = match.score_b || 0;
            
            playerStats[playerAId].battlesWon += scoreA;
            playerStats[playerAId].battlesLost += scoreB;

            if (scoreA > scoreB) {
              playerStats[playerAId].won++;
            } else if (scoreB > scoreA) {
              playerStats[playerAId].lost++;
            }

            if (result) {
              playerStats[playerAId].points += result.points_a || 0;
            }
          }

          if (playerStats[playerBId]) {
            playerStats[playerBId].played++;
            const scoreA = match.score_a || 0;
            const scoreB = match.score_b || 0;
            
            playerStats[playerBId].battlesWon += scoreB;
            playerStats[playerBId].battlesLost += scoreA;

            if (scoreB > scoreA) {
              playerStats[playerBId].won++;
            } else if (scoreA > scoreB) {
              playerStats[playerBId].lost++;
            }

            if (result) {
              playerStats[playerBId].points += result.points_b || 0;
            }
          }
        });
      }

      // Convert to array and sort
      const standingsArray = Object.values(playerStats).sort((a, b) => {
        // Sort by points descending
        if (b.points !== a.points) return b.points - a.points;
        // Then by battles won
        if (b.battlesWon !== a.battlesWon) return b.battlesWon - a.battlesWon;
        // Then by battles difference
        const diffA = a.battlesWon - a.battlesLost;
        const diffB = b.battlesWon - b.battlesLost;
        if (diffB !== diffA) return diffB - diffA;
        // Finally, by ranking (lower ranking_seed = better rank)
        const rankA = a.ranking_seed || 9999;
        const rankB = b.ranking_seed || 9999;
        return rankA - rankB;
      });

      setStandings(standingsArray);
    } catch (error) {
      console.error("Error calculating standings:", error);
      setStandings([]);
    } finally {
      setLoading(false);
    }
  }

  async function openBattlesModal(match) {
    setSelectedMatch(match);
    setViewBattlesModal(true);
    setExpandedBattles(new Set());
    await loadLinkedBattlesForMatch(match.scheduled_match_id, match.player_a_id, match.player_b_id);
  }

  async function loadLinkedBattlesForMatch(scheduledMatchId, playerAId, playerBId) {
    if (!scheduledMatchId) {
      setBattlesData([]);
      return;
    }
    
    // Get linked battles
    const { data: links } = await supabase
      .from("scheduled_match_battle_link")
      .select("battle_id")
      .eq("scheduled_match_id", scheduledMatchId);
    
    if (!links || links.length === 0) {
      setBattlesData([]);
      return;
    }
    
    const battleIds = links.map(l => l.battle_id);
    
    // Get battles
    const { data: battles } = await supabase
      .from("battle")
      .select("battle_id, battle_time, api_game_mode, api_battle_type, round_count")
      .in("battle_id", battleIds)
      .order("battle_time", { ascending: false });
    
    if (!battles || battles.length === 0) {
      setBattlesData([]);
      return;
    }
    
    // Get battle rounds
    const { data: battleRounds } = await supabase
      .from("battle_round")
      .select("battle_round_id, battle_id, round_no")
      .in("battle_id", battleIds);
    
    console.log("battleRounds:", battleRounds);
    
    if (!battleRounds || battleRounds.length === 0) {
      console.log("No battle rounds found");
      setBattlesData([]);
      return;
    }
    
    // Get round players with deck info
    const battleRoundIds = (battleRounds || []).map(r => r.battle_round_id);
    console.log("battleRoundIds:", battleRoundIds);
    
    const { data: roundPlayers } = await supabase
      .from("battle_round_player")
      .select(`
        battle_round_id,
        player_id,
        side,
        crowns,
        opponent_crowns,
        deck_cards,
        elixir_avg,
        opponent
      `)
      .in("battle_round_id", battleRoundIds);
    
    console.log("roundPlayers:", roundPlayers);
    
    // Get all player IDs from rounds
    const allPlayerIds = new Set([playerAId, playerBId]);
    (roundPlayers || []).forEach(rp => {
      if (rp.player_id) allPlayerIds.add(rp.player_id);
    });
    
    // Get players
    const { data: players } = await supabase
      .from("player")
      .select("player_id, name, nick")
      .in("player_id", Array.from(allPlayerIds));
    
    console.log("players:", players);
    
    const playersById = {};
    (players || []).forEach(p => playersById[p.player_id] = p);
    
    // Load card data
    const { data: cardsData } = await supabase
      .from("card")
      .select("card_id, raw_payload");
    
    const cards = {};
    (cardsData || []).forEach(c => {
      if (c.raw_payload) {
        cards[c.card_id] = c.raw_payload;
      }
    });
    setCardsById(cards);
    
    // Group rounds by battle
    const roundsByBattle = {};
    (battleRounds || []).forEach(br => {
      if (!roundsByBattle[br.battle_id]) roundsByBattle[br.battle_id] = [];
      roundsByBattle[br.battle_id].push(br);
    });
    
    const roundPlayersByRound = {};
    (roundPlayers || []).forEach(rp => {
      if (!roundPlayersByRound[rp.battle_round_id]) roundPlayersByRound[rp.battle_round_id] = [];
      roundPlayersByRound[rp.battle_round_id].push(rp);
    });
    
    // Build battle data with summaries
    const enrichedBattles = battles.map(battle => {
      const battleRoundsForThis = roundsByBattle[battle.battle_id] || [];
      const rounds = battleRoundsForThis.flatMap(br => 
        (roundPlayersByRound[br.battle_round_id] || []).map(rp => ({
          ...rp,
          round_no: br.round_no
        }))
      );
      
      console.log("Battle:", battle.battle_id, "rounds:", rounds, "playersById:", playersById, "playerAId:", playerAId, "playerBId:", playerBId);
      
      const summary = computeBattleSummary({ battle, rounds, playersById, playerAId, playerBId });
      
      console.log("Summary:", summary);
      
      return { battle, rounds, summary };
    });
    
    setBattlesData(enrichedBattles);
  }

  function toggleBattleExpand(battleId) {
    const next = new Set(expandedBattles);
    if (next.has(battleId)) next.delete(battleId);
    else next.add(battleId);
    setExpandedBattles(next);
  }

  function getCardImageUrl(cardId, evolutionLevel) {
    const cardData = cardsById[cardId];
    if (cardData && cardData.iconUrls) {
      if (evolutionLevel === 2 && cardData.iconUrls.heroMedium) {
        return cardData.iconUrls.heroMedium;
      }
      if (evolutionLevel === 1 && cardData.iconUrls.evolutionMedium) {
        return cardData.iconUrls.evolutionMedium;
      }
      if (cardData.iconUrls.medium) {
        return cardData.iconUrls.medium;
      }
    }
    return null;
  }

  function getDisplayLevel(cardId, battleLevel, evolutionLevel) {
    if (!battleLevel) return battleLevel;
    const cardData = cardsById[cardId];
    if (!cardData) return battleLevel + (evolutionLevel || 0);
    const displayLevel = battleLevel + (16 - (cardData.maxLevel || 16));
    return displayLevel;
  }

  return (
    <div className="min-h-screen bg-[#070B14] text-white">
      {/* Background glow */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(59,130,246,0.18),transparent_55%),radial-gradient(circle_at_80%_30%,rgba(56,189,248,0.10),transparent_55%)]" />

      <div className="relative mx-auto w-full max-w-7xl px-4 py-6">
        {/* Header */}
        <div className="flex items-start gap-3 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="mt-1 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 ring-1 ring-white/10 hover:bg-white/10"
            aria-label="Volver"
          >
            ←
          </button>

          <div className="flex-1">
            <h1 className="text-2xl font-semibold">Tabla de Posiciones por Grupo</h1>
            <p className="mt-1 text-sm text-white/60">
              Consulta las posiciones de jugadores en cada grupo de copa
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10 backdrop-blur mb-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* Season */}
            <div>
              <div className="text-sm text-white/70 mb-2">Temporada</div>
              <select
                value={seasonId}
                onChange={(e) => navigate(`/admin/seasons/${e.target.value}/group-standings`)}
                className="w-full rounded-xl bg-[#0b1220] border border-white/10 px-3 py-2.5 outline-none focus:border-white/20"
              >
                <option value="">Seleccionar...</option>
                {seasons.map((s) => (
                  <option key={s.season_id} value={s.season_id}>
                    {s.description}
                  </option>
                ))}
              </select>
            </div>

            {/* Zone */}
            <div>
              <div className="text-sm text-white/70 mb-2">Zona</div>
              <select
                value={selectedZoneId}
                onChange={(e) => setSelectedZoneId(e.target.value)}
                disabled={!seasonId}
                className="w-full rounded-xl bg-[#0b1220] border border-white/10 px-3 py-2.5 outline-none focus:border-white/20 disabled:opacity-50"
              >
                <option value="">Seleccionar...</option>
                {zones.map((z) => (
                  <option key={z.zone_id} value={z.zone_id}>
                    {z.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Competition */}
            <div>
              <div className="text-sm text-white/70 mb-2">Copa</div>
              <select
                value={selectedCompetitionId}
                onChange={(e) => setSelectedCompetitionId(e.target.value)}
                disabled={!selectedZoneId}
                className="w-full rounded-xl bg-[#0b1220] border border-white/10 px-3 py-2.5 outline-none focus:border-white/20 disabled:opacity-50"
              >
                <option value="">Seleccionar...</option>
                {competitions.map((c) => (
                  <option key={c.competition_id} value={c.competition_id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Stage */}
            <div>
              <div className="text-sm text-white/70 mb-2">Etapa</div>
              <select
                value={selectedStageId}
                onChange={(e) => setSelectedStageId(e.target.value)}
                disabled={!selectedCompetitionId}
                className="w-full rounded-xl bg-[#0b1220] border border-white/10 px-3 py-2.5 outline-none focus:border-white/20 disabled:opacity-50"
              >
                <option value="">Seleccionar...</option>
                {stages.map((st) => (
                  <option key={st.competition_stage_id} value={st.competition_stage_id}>
                    {st.stage}
                  </option>
                ))}
              </select>
            </div>

            {/* Group */}
            <div>
              <div className="text-sm text-white/70 mb-2">Grupo</div>
              <select
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                disabled={!selectedStageId}
                className="w-full rounded-xl bg-[#0b1220] border border-white/10 px-3 py-2.5 outline-none focus:border-white/20 disabled:opacity-50"
              >
                <option value="">Seleccionar...</option>
                {groups.map((g) => (
                  <option key={g.competition_group_id} value={g.competition_group_id}>
                    {g.name} {g.code ? `(${g.code})` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Standings Table */}
        <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
          <div className="border-b border-white/10 px-4 py-3 flex items-center justify-between">
            <div className="text-sm font-semibold">Tabla de Posiciones</div>
            <div className="flex items-center gap-3">
              {standings.length > 0 && (
                <button
                  onClick={() => setShowShareModal(true)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-200 font-semibold transition flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-sm">share</span>
                  Compartir
                </button>
              )}
              <div className="text-xs text-white/60">
                {standings.length} jugadores
              </div>
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center text-white/60">Cargando...</div>
          ) : standings.length === 0 ? (
            <div className="p-8 text-center text-white/60">
              No hay datos para mostrar. Selecciona temporada, zona, copa y grupo.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-white/5 border-b border-white/10">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white/70">#</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white/70">Jugador</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-white/70">PJ</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-white/70">PG</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-white/70">PP</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-white/70">BG</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-white/70">BP</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-white/70">Dif</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-white/70">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((player, index) => (
                    <tr
                      key={player.player_id}
                      className={`border-b border-white/10 hover:bg-white/5 transition ${
                        index === 0 ? "bg-gradient-to-r from-amber-500/20 to-yellow-500/10 border-amber-500/30" : ""
                      }`}
                    >
                      <td className="px-4 py-3 text-sm">
                        {index === 0 ? (
                          <span className="inline-flex items-center gap-1 font-bold text-amber-400">
                            <span>👑</span>
                            <span>1</span>
                          </span>
                        ) : (
                          <span className="text-white/70">{index + 1}</span>
                        )}
                      </td>
                      <td className={`px-4 py-3 text-sm font-semibold ${index === 0 ? "text-amber-400" : ""}`}>
                        <div className="flex items-center gap-2">
                          {player.team?.logo ? (
                            <img 
                              src={player.team.logo} 
                              alt={player.team.name}
                              className="w-6 h-6 rounded-full object-cover"
                              title={player.team.name}
                            />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center">
                              <span className="text-[8px] text-white/40">?</span>
                            </div>
                          )}
                          <div>
                            {player.name}
                            {player.ranking_seed && (
                              <span className="ml-2 text-xs text-white/50">(#{player.ranking_seed})</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-center text-white/80">{player.played}</td>
                      <td className="px-4 py-3 text-sm text-center text-emerald-400">{player.won}</td>
                      <td className="px-4 py-3 text-sm text-center text-rose-400">{player.lost}</td>
                      <td className="px-4 py-3 text-sm text-center text-white/80">{player.battlesWon}</td>
                      <td className="px-4 py-3 text-sm text-center text-white/80">{player.battlesLost}</td>
                      <td className="px-4 py-3 text-sm text-center text-white/70">
                        {player.battlesWon - player.battlesLost > 0 ? '+' : ''}{player.battlesWon - player.battlesLost}
                      </td>
                      <td className={`px-4 py-3 text-sm text-center font-bold ${index === 0 ? "text-amber-400" : "text-blue-400"}`}>
                        {player.points}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Matches List */}
        {matches.length > 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden mt-6">
            <div className="border-b border-white/10 px-4 py-3 flex items-center justify-between">
              <div className="text-sm font-semibold">Partidos del Grupo</div>
              <div className="text-xs text-white/60">
                {matches.length} partidos
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-white/5 border-b border-white/10">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white/70">Fecha</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white/70">Jugador A</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-white/70">Resultado</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-white/70">Jugador B</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-white/70">Estado</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-white/70">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {matches.map((match) => {
                    const hasResult = match.score_a !== null && match.score_b !== null;
                    const playerAName = match.player_a?.nick || match.player_a?.name || "Jugador A";
                    const playerBName = match.player_b?.nick || match.player_b?.name || "Jugador B";
                    
                    return (
                      <tr
                        key={match.scheduled_match_id}
                        className="border-b border-white/10 hover:bg-white/5 transition"
                      >
                        <td className="px-4 py-3 text-sm text-white/70">
                          {match.scheduled_from ? new Date(match.scheduled_from).toLocaleDateString('es-ES', { 
                            day: '2-digit', 
                            month: '2-digit', 
                            year: 'numeric' 
                          }) : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="font-semibold">{playerAName}</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-center">
                          {hasResult ? (
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-white/5">
                              <span className={match.score_a > match.score_b ? "font-bold text-emerald-400" : "text-white/80"}>
                                {match.score_a}
                              </span>
                              <span className="text-white/40">-</span>
                              <span className={match.score_b > match.score_a ? "font-bold text-emerald-400" : "text-white/80"}>
                                {match.score_b}
                              </span>
                            </div>
                          ) : (
                            <span className="text-white/40 text-xs">Sin resultado</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-right">
                          <div className="font-semibold">{playerBName}</div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-block px-2 py-1 text-xs rounded-lg ${
                            match.status === "COMPLETED" 
                              ? "bg-emerald-500/20 text-emerald-400" 
                              : match.status === "PENDING"
                              ? "bg-yellow-500/20 text-yellow-400"
                              : "bg-white/10 text-white/60"
                          }`}>
                            {match.status || "PENDING"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {match.status === "PENDING" ? (
                              <button
                                onClick={() => {
                                  setSelectedMatchForEdit(match);
                                  setShowEditModal(true);
                                }}
                                className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-200 transition"
                                title="Editar partido"
                              >
                                <span className="material-symbols-outlined text-base">edit</span>
                              </button>
                            ) : (
                              <>
                                <button
                                  onClick={() => openBattlesModal(match)}
                                  className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-200 transition"
                                  title="Ver batallas"
                                >
                                  <span className="material-symbols-outlined text-base">visibility</span>
                                </button>
                                <button
                                  onClick={() => {
                                    setSelectedMatchForEdit(match);
                                    setShowEditModal(true);
                                  }}
                                  className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-200 transition"
                                  title="Editar partido"
                                >
                                  <span className="material-symbols-outlined text-base">edit</span>
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Battles Modal */}
      {viewBattlesModal && selectedMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="w-full max-w-6xl rounded-2xl border border-white/10 bg-[#0a0f1b] overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold">
                  Batallas Vinculadas
                </div>
                <div className="text-sm text-white/60 mt-1">
                  {(selectedMatch.player_a?.nick || selectedMatch.player_a?.name || "Jugador A")}{" "}
                  <span className="text-white/40">vs</span>{" "}
                  {(selectedMatch.player_b?.nick || selectedMatch.player_b?.name || "Jugador B")}
                </div>
              </div>
              <button
                onClick={() => setViewBattlesModal(false)}
                className="h-10 w-10 flex items-center justify-center text-white/70 hover:text-white rounded-xl hover:bg-white/10 transition"
              >
                ✕
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1">
              {battlesData.length === 0 ? (
                <div className="text-center py-8 text-white/60">
                  No hay batallas vinculadas a este partido.
                </div>
              ) : (
                <div className="space-y-4">
                  {battlesData.map(({ battle, rounds, summary }) => {
                    const isOpen = expandedBattles.has(battle.battle_id);
                    const winnerLeft = summary.winner === "LEFT";
                    const winnerRight = summary.winner === "RIGHT";

                    return (
                      <div
                        key={battle.battle_id}
                        className="rounded-2xl border border-white/10 bg-white/5 p-4"
                      >
                        {/* Header */}
                        <button
                          className="w-full text-left"
                          onClick={() => toggleBattleExpand(battle.battle_id)}
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
                                <div className="text-sm">{battle.api_battle_type || "—"}</div>
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

                        {/* Detail */}
                        {isOpen && (
                          <div className="mt-4 border-t border-white/10 pt-4">
                            <div className="text-sm font-semibold mb-3">Detalle</div>
                            <div className="space-y-3">
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

                                  {/* TEAM and OPPONENT players side by side */}
                                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                    {/* TEAM players */}
                                    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                                      <div className="mb-2 text-xs text-white/60">TEAM</div>
                                      {(rr.team || []).map((teamRecord, idx) => {
                                        const playerCards = Array.isArray(teamRecord.deck_cards) ? teamRecord.deck_cards : [];
                                        
                                        return (
                                          <div key={idx} className="mb-3 last:mb-0">
                                            <div className="flex items-center justify-between">
                                              <div className="text-sm font-semibold">TEAM</div>
                                              <div className="text-xs text-white/70">👑 {teamRecord.crowns ?? 0}</div>
                                            </div>
                                            <div className="mt-2 grid grid-cols-4 gap-2">
                                              {playerCards.slice(0, 8).map((c, cidx) => (
                                                <div
                                                  key={cidx}
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
                                                  <div className="absolute inset-0 hidden w-full h-full bg-slate-950/60 flex items-center justify-center text-center text-[10px] text-white/70 p-1">
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
                                        (rr.opp || []).map((oppRecord, idx) => {
                                          const oppCards = Array.isArray(oppRecord.deck_cards) ? oppRecord.deck_cards : [];
                                          
                                          return (
                                            <div key={idx} className="mb-3 last:mb-0">
                                              <div className="flex items-center justify-between">
                                                <div className="text-sm font-semibold">OPPONENT</div>
                                                <div className="text-xs text-white/70">👑 {rr.oppCrowns ?? 0}</div>
                                              </div>
                                              <div className="mt-2 grid grid-cols-4 gap-2">
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
                                                    <div className="absolute inset-0 hidden w-full h-full bg-slate-950/60 flex items-center justify-center text-center text-[10px] text-white/70 p-1">
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
                                        // Unregistered opponents
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
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-white/10 flex items-center justify-end">
              <button
                onClick={() => setViewBattlesModal(false)}
                className="rounded-xl px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 transition font-semibold"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Match Modal */}
      <ScheduledMatchEditModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedMatchForEdit(null);
        }}
        matchData={selectedMatchForEdit}
        onSaved={() => {
          calculateStandings();
          setShowEditModal(false);
          setSelectedMatchForEdit(null);
        }}
      />

      {/* Shareable Standings Modal */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="w-full max-w-4xl rounded-2xl border border-white/10 bg-[#0a0f1b] overflow-hidden">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <div className="text-lg font-semibold">
                Tabla para Compartir
              </div>
              <button
                onClick={() => setShowShareModal(false)}
                className="h-10 w-10 flex items-center justify-center text-white/70 hover:text-white rounded-xl hover:bg-white/10 transition"
              >
                ✕
              </button>
            </div>

            <div className="p-6">
              {/* Shareable standings card with Clash Royale style */}
              <div 
                id="shareable-standings"
                className="relative rounded-3xl overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg, #0a1628 0%, #152238 50%, #0a1628 100%)',
                  boxShadow: '0 0 0 3px rgba(100, 116, 139, 0.3), 0 20px 40px rgba(0, 0, 0, 0.5)',
                  padding: '2rem'
                }}
              >
                {/* Circuit board pattern overlay */}
                <div 
                  className="absolute inset-0 opacity-10"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 30h30M30 0v30' stroke='%23ffffff' stroke-width='1' fill='none'/%3E%3C/svg%3E")`,
                    backgroundSize: '60px 60px'
                  }}
                />

                <div className="relative z-10">
                  {/* Header */}
                  <div className="text-center mb-6">
                    <div 
                      className="text-3xl font-bold mb-2"
                      style={{
                        color: '#fbbf24',
                        textShadow: '0 0 20px rgba(251, 191, 36, 0.5), 0 2px 4px rgba(0, 0, 0, 0.5)'
                      }}
                    >
                      {groups.find(g => g.competition_group_id === selectedGroupId)?.name || 'GRUPO'}
                    </div>
                    <h2 
                      className="text-3xl font-bold mb-1"
                      style={{
                        color: '#5ce1e6',
                        textShadow: '0 0 20px rgba(92, 225, 230, 0.5), 0 2px 4px rgba(0, 0, 0, 0.5)'
                      }}
                    >
                      TABLA DE POSICIONES
                    </h2>
                    <div className="text-sm text-white/70 mt-2">
                      {(() => {
                        const pendingMatches = matches.filter(m => m.score_a === null || m.score_b === null);
                        return pendingMatches.length > 0 
                          ? `${pendingMatches.length} ${pendingMatches.length === 1 ? 'BATALLA RESTANTE' : 'BATALLAS RESTANTES'}`
                          : 'TODAS LAS BATALLAS COMPLETADAS';
                      })()}
                    </div>
                  </div>

                  {/* Standings List */}
                  <div className="space-y-2">
                    {standings.map((player, index) => {
                      const isFirst = index === 0;
                      const diff = player.battlesWon - player.battlesLost;
                      
                      return (
                        <div
                          key={player.player_id}
                          className="rounded-2xl overflow-hidden"
                          style={{
                            background: isFirst 
                              ? 'linear-gradient(90deg, rgba(251, 191, 36, 0.2) 0%, rgba(251, 191, 36, 0.05) 100%)'
                              : 'linear-gradient(90deg, rgba(30, 58, 138, 0.3) 0%, rgba(30, 58, 138, 0.1) 100%)',
                            border: isFirst ? '2px solid rgba(251, 191, 36, 0.4)' : '2px solid rgba(71, 85, 105, 0.3)',
                            boxShadow: isFirst ? '0 0 20px rgba(251, 191, 36, 0.2)' : 'none'
                          }}
                        >
                          <div className="flex items-center gap-3 px-4 py-3">
                            {/* Position Badge */}
                            <div 
                              className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg"
                              style={{
                                background: isFirst 
                                  ? 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)'
                                  : index === 1
                                  ? 'linear-gradient(135deg, #94a3b8 0%, #64748b 100%)'
                                  : index === 2
                                  ? 'linear-gradient(135deg, #d97706 0%, #b45309 100%)'
                                  : 'rgba(51, 65, 85, 0.8)',
                                color: isFirst || index === 1 || index === 2 ? '#ffffff' : '#94a3b8',
                                boxShadow: isFirst ? '0 4px 12px rgba(251, 191, 36, 0.4)' : 'none'
                              }}
                            >
                              {index + 1}
                            </div>

                            {/* Team Logo */}
                            {player.team?.logo ? (
                              <div 
                                className="flex-shrink-0 w-12 h-12 rounded-full overflow-hidden"
                                style={{
                                  border: '2px solid rgba(100, 116, 139, 0.3)',
                                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)'
                                }}
                              >
                                <img 
                                  src={player.team.logo} 
                                  alt={player.team.name}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            ) : (
                              <div 
                                className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center"
                                style={{
                                  background: 'rgba(51, 65, 85, 0.5)',
                                  border: '2px solid rgba(100, 116, 139, 0.3)'
                                }}
                              >
                                <span className="material-symbols-outlined text-white/40">shield</span>
                              </div>
                            )}

                            {/* Player Name */}
                            <div className="flex-1 min-w-0">
                              <div 
                                className="font-bold text-lg"
                                style={{
                                  color: isFirst ? '#fbbf24' : '#ffffff',
                                  textShadow: isFirst ? '0 2px 4px rgba(0, 0, 0, 0.5)' : 'none'
                                }}
                              >
                                {player.name}
                                {player.ranking_seed && (
                                  <span 
                                    className="ml-2 text-sm font-normal"
                                    style={{ color: 'rgba(255, 255, 255, 0.5)' }}
                                  >
                                    (#{player.ranking_seed})
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Stats */}
                            <div className="flex items-center gap-4 flex-shrink-0">
                              {/* Matches */}
                              <div className="text-center">
                                <div className="flex items-center gap-1">
                                  <span className="material-symbols-outlined text-base text-white/60">swords</span>
                                  <span className="font-bold text-white">{player.played}</span>
                                </div>
                              </div>

                              {/* Wins */}
                              <div className="text-center">
                                <div className="flex items-center gap-1">
                                  <span className="material-symbols-outlined text-base text-green-400">thumb_up</span>
                                  <span className="font-bold text-green-400">{player.won}</span>
                                </div>
                              </div>

                              {/* Losses */}
                              <div className="text-center">
                                <div className="flex items-center gap-1">
                                  <span className="material-symbols-outlined text-base text-red-400">thumb_down</span>
                                  <span className="font-bold text-red-400">{player.lost}</span>
                                </div>
                              </div>

                              {/* Battles */}
                              <div className="text-center">
                                <div className="flex items-center gap-1">
                                  <span className="material-symbols-outlined text-base text-white/60">target</span>
                                  <span className="font-bold text-white">{player.battlesWon}</span>
                                </div>
                              </div>

                              {/* Shield (Goal Diff) */}
                              <div className="text-center min-w-[50px]">
                                <div className="flex items-center justify-center gap-1">
                                  <span className="material-symbols-outlined text-base text-white/60">shield</span>
                                  <span 
                                    className="font-bold"
                                    style={{
                                      color: diff > 0 ? '#4ade80' : diff < 0 ? '#f87171' : '#94a3b8'
                                    }}
                                  >
                                    {diff > 0 ? '+' : ''}{diff}
                                  </span>
                                </div>
                              </div>

                              {/* Points */}
                              <div 
                                className="flex-shrink-0 w-14 h-14 rounded-xl flex items-center justify-center font-bold text-2xl"
                                style={{
                                  background: isFirst 
                                    ? 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)'
                                    : 'rgba(34, 211, 238, 0.15)',
                                  color: isFirst ? '#ffffff' : '#22d3ee',
                                  border: '2px solid ' + (isFirst ? 'rgba(251, 191, 36, 0.4)' : 'rgba(34, 211, 238, 0.3)'),
                                  boxShadow: isFirst ? '0 4px 12px rgba(251, 191, 36, 0.3)' : 'none'
                                }}
                              >
                                {player.points}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="mt-4 text-xs text-white/60 text-center">
                Captura de pantalla para compartir en redes sociales
              </div>
            </div>

            <div className="p-4 border-t border-white/10 flex items-center justify-end">
              <button
                onClick={() => setShowShareModal(false)}
                className="rounded-xl px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 transition font-semibold"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
