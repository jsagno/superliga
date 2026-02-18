import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabaseClient";

function toInputValue(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hh}:${mm}`;
  } catch {
    return "";
  }
}

function fromInputValue(val) {
  if (!val) return null;
  try {
    return new Date(val).toISOString();
  } catch {
    return null;
  }
}

export default function ScheduledMatchEditModal({ 
  isOpen, 
  onClose, 
  matchData,
  onSaved 
}) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [linkedBattles, setLinkedBattles] = useState([]);
  const [availableBattles, setAvailableBattles] = useState([]);
  const [loadingBattles, setLoadingBattles] = useState(false);
  const [linkingBattle, setLinkingBattle] = useState(null);
  const [manualResult, setManualResult] = useState({ 
    final_score_a: "", 
    final_score_b: "", 
    points_a: "", 
    points_b: "", 
    decided_by: "ADMIN" 
  });
  const [editPlayerNames, setEditPlayerNames] = useState({ playerA: "", playerB: "" });

  useEffect(() => {
    if (isOpen && matchData) {
      loadMatchData();
    }
  }, [isOpen, matchData]);

  async function loadMatchData() {
    if (!matchData) return;

    // Set player names for title
    setEditPlayerNames({
      playerA: matchData.player_a?.nick || matchData.player_a?.name || "Jugador A",
      playerB: matchData.player_b?.nick || matchData.player_b?.name || "Jugador B"
    });

    // Load battles data
    await loadLinkedBattles(matchData.scheduled_match_id);
    await loadAvailableBattles(
      matchData.player_a_id || matchData.player_a?.player_id,
      matchData.player_b_id || matchData.player_b?.player_id,
      matchData.scheduled_from,
      matchData.scheduled_to,
      matchData.scheduled_match_id
    );

    // Load existing result
    const { data: existingResult } = await supabase
      .from("scheduled_match_result")
      .select("final_score_a, final_score_b, points_a, points_b, decided_by")
      .eq("scheduled_match_id", matchData.scheduled_match_id)
      .maybeSingle();

    // Calculate suggested result if no result set yet
    if (matchData.score_a == null || matchData.score_b == null) {
      const suggested = await calculateSuggestedResult(
        matchData.scheduled_match_id,
        matchData.season_id,
        matchData.competition_id,
        matchData.stage
      );
      setManualResult({
        final_score_a: suggested?.scoreA ?? "",
        final_score_b: suggested?.scoreB ?? "",
        points_a: suggested?.pointsA ?? "",
        points_b: suggested?.pointsB ?? "",
        decided_by: "ADMIN"
      });
    } else {
      setManualResult({
        final_score_a: existingResult?.final_score_a ?? matchData.score_a ?? "",
        final_score_b: existingResult?.final_score_b ?? matchData.score_b ?? "",
        points_a: existingResult?.points_a ?? "",
        points_b: existingResult?.points_b ?? "",
        decided_by: existingResult?.decided_by ?? "ADMIN"
      });
    }
  }

  async function calculateSuggestedResult(scheduledMatchId, seasonId, competitionId, stage) {
    if (!seasonId || !competitionId || !stage) return null;

    const { data: config } = await supabase
      .from("season_competition_config")
      .select("api_battle_type, api_game_mode, best_of, points_schema")
      .eq("season_id", seasonId)
      .eq("competition_id", competitionId)
      .eq("stage", stage)
      .maybeSingle();

    if (!config) return null;

    const { data: links } = await supabase
      .from("scheduled_match_battle_link")
      .select("battle_id")
      .eq("scheduled_match_id", scheduledMatchId);

    if (!links || links.length === 0) return null;

    const battleIds = links.map(l => l.battle_id);
    const { data: battles } = await supabase
      .from("battle")
      .select("battle_id, round_count")
      .in("battle_id", battleIds);

    if (!battles) return null;

    const { data: battleRounds } = await supabase
      .from("battle_round")
      .select("battle_round_id, battle_id, round_no")
      .in("battle_id", battleIds);

    const battleRoundIds = (battleRounds || []).map(r => r.battle_round_id);
    const { data: roundPlayers } = await supabase
      .from("battle_round_player")
      .select("battle_round_id, player_id, side, crowns, opponent_crowns")
      .in("battle_round_id", battleRoundIds);

    const { data: match } = await supabase
      .from("scheduled_match")
      .select("player_a_id, player_b_id")
      .eq("scheduled_match_id", scheduledMatchId)
      .single();

    if (!match) return null;

    const playerAId = match.player_a_id;
    const playerBId = match.player_b_id;

    let playerAWins = 0;
    let playerBWins = 0;

    battles.forEach(battle => {
      const battleRoundsForThis = (battleRounds || []).filter(r => r.battle_id === battle.battle_id);
      const roundNos = [...new Set(battleRoundsForThis.map(r => r.round_no))].sort((a, b) => a - b);

      let teamWins = 0;
      let oppWins = 0;
      let teamTotalCrowns = 0;
      let oppTotalCrowns = 0;

      roundNos.forEach(rn => {
        const roundIds = battleRoundsForThis.filter(r => r.round_no === rn).map(r => r.battle_round_id);
        const roundPlayerData = (roundPlayers || []).filter(rp => roundIds.includes(rp.battle_round_id));

        const teamData = roundPlayerData.filter(rp => rp.side === "TEAM");
        const oppData = roundPlayerData.filter(rp => rp.side === "OPPONENT");

        const teamCrowns = teamData.reduce((sum, rp) => sum + (rp.crowns || 0), 0);
        const oppCrowns = teamData.reduce((sum, rp) => sum + (rp.opponent_crowns || 0), 0) +
          oppData.reduce((sum, rp) => sum + (rp.crowns || 0), 0);

        teamTotalCrowns += teamCrowns;
        oppTotalCrowns += oppCrowns;

        if (teamCrowns > oppCrowns) teamWins++;
        else if (oppCrowns > teamCrowns) oppWins++;
      });

      const battleRoundIds = battleRoundsForThis.map(r => r.battle_round_id);
      const teamPlayer = (roundPlayers || []).find(rp =>
        battleRoundIds.includes(rp.battle_round_id) &&
        rp.side === "TEAM" &&
        (rp.player_id === playerAId || rp.player_id === playerBId)
      );

      const teamPlayerId = teamPlayer?.player_id;
      const battleWinner = battle.round_count > 1
        ? (teamWins > oppWins ? teamPlayerId : (oppWins > teamWins ? (teamPlayerId === playerAId ? playerBId : playerAId) : null))
        : (teamTotalCrowns > oppTotalCrowns ? teamPlayerId : (oppTotalCrowns > teamTotalCrowns ? (teamPlayerId === playerAId ? playerBId : playerAId) : null));

      if (battleWinner === playerAId) playerAWins++;
      else if (battleWinner === playerBId) playerBWins++;
    });

    const scoreKey = `${playerAWins}-${playerBWins}`;
    const pointsSchema = config.points_schema || {};
    const pointsA = pointsSchema[scoreKey] !== undefined ? pointsSchema[scoreKey] : 0;
    const pointsB = pointsSchema[`${playerBWins}-${playerAWins}`] !== undefined ? pointsSchema[`${playerBWins}-${playerAWins}`] : 0;

    return {
      scoreA: playerAWins,
      scoreB: playerBWins,
      pointsA,
      pointsB
    };
  }

  async function loadLinkedBattles(scheduledMatchId) {
    if (!scheduledMatchId) {
      setLinkedBattles([]);
      return;
    }

    const { data } = await supabase
      .from("scheduled_match_battle_link")
      .select("battle_id, linked_by_player, linked_by_admin")
      .eq("scheduled_match_id", scheduledMatchId);

    if (!data || data.length === 0) {
      setLinkedBattles([]);
      return;
    }

    const battleIds = data.map(d => d.battle_id);
    const { data: battles } = await supabase
      .from("battle")
      .select("battle_id, battle_time, api_game_mode, api_battle_type, round_count")
      .in("battle_id", battleIds)
      .order("battle_time", { ascending: false });

    if (!battles) {
      setLinkedBattles([]);
      return;
    }

    const { data: match } = await supabase
      .from("scheduled_match")
      .select("player_a_id, player_b_id, zone_id")
      .eq("scheduled_match_id", scheduledMatchId)
      .single();

    if (!match) {
      setLinkedBattles([]);
      return;
    }

    const playerAId = match.player_a_id;
    const playerBId = match.player_b_id;
    const zoneId = match.zone_id;

    const { data: battleRounds } = await supabase
      .from("battle_round")
      .select("battle_round_id, battle_id, round_no")
      .in("battle_id", battleIds);

    const battleRoundIds = (battleRounds || []).map(r => r.battle_round_id);
    const { data: roundPlayers } = await supabase
      .from("battle_round_player")
      .select("battle_round_id, player_id, side, crowns, opponent_crowns")
      .in("battle_round_id", battleRoundIds);

    const { data: playerData } = await supabase
      .from("player")
      .select("player_id, name, nick")
      .in("player_id", [playerAId, playerBId]);

    const playersById = {};
    (playerData || []).forEach(p => playersById[p.player_id] = p);

    // Get team assignments
    const { data: teamAssignments } = await supabase
      .from("season_zone_team_player")
      .select("player_id, team_id, team:team(team_id, name, logo)")
      .eq("zone_id", zoneId)
      .in("player_id", [playerAId, playerBId]);

    const teamsByPlayerId = {};
    (teamAssignments || []).forEach(ta => {
      if (ta.team) teamsByPlayerId[ta.player_id] = ta.team;
    });

    const enrichedData = data.map(link => {
      const battle = (battles || []).find(b => b.battle_id === link.battle_id);

      if (!battle) {
        return {
          ...link,
          battle_time: null,
          api_game_mode: null,
          api_battle_type: null,
          round_count: null,
        };
      }

      const battleRoundsForThis = (battleRounds || []).filter(r => r.battle_id === battle.battle_id);
      const roundNos = [...new Set(battleRoundsForThis.map(r => r.round_no))].sort((a, b) => a - b);

      let teamWins = 0;
      let oppWins = 0;
      let teamTotalCrowns = 0;
      let oppTotalCrowns = 0;

      roundNos.forEach(rn => {
        const roundIds = battleRoundsForThis.filter(r => r.round_no === rn).map(r => r.battle_round_id);
        const roundPlayerData = (roundPlayers || []).filter(rp => roundIds.includes(rp.battle_round_id));

        const teamData = roundPlayerData.filter(rp => rp.side === "TEAM");
        const oppData = roundPlayerData.filter(rp => rp.side === "OPPONENT");

        const teamCrowns = teamData.reduce((sum, rp) => sum + (rp.crowns || 0), 0);
        const oppCrowns = teamData.reduce((sum, rp) => sum + (rp.opponent_crowns || 0), 0) +
          oppData.reduce((sum, rp) => sum + (rp.crowns || 0), 0);

        teamTotalCrowns += teamCrowns;
        oppTotalCrowns += oppCrowns;

        if (teamCrowns > oppCrowns) teamWins++;
        else if (oppCrowns > teamCrowns) oppWins++;
      });

      const battleRoundIds = battleRoundsForThis.map(r => r.battle_round_id);
      const teamPlayer = (roundPlayers || []).find(rp =>
        battleRoundIds.includes(rp.battle_round_id) &&
        rp.side === "TEAM" &&
        (rp.player_id === playerAId || rp.player_id === playerBId)
      );

      let titleLeft, titleRight, scoreLeft, scoreRight;

      if (teamPlayer?.player_id === playerAId) {
        titleLeft = playersById[playerAId]?.nick || playersById[playerAId]?.name || "Player A";
        titleRight = playersById[playerBId]?.nick || playersById[playerBId]?.name || "Player B";
        scoreLeft = battle.round_count > 1 ? teamWins : teamTotalCrowns;
        scoreRight = battle.round_count > 1 ? oppWins : oppTotalCrowns;
      } else {
        titleLeft = playersById[playerAId]?.nick || playersById[playerAId]?.name || "Player A";
        titleRight = playersById[playerBId]?.nick || playersById[playerBId]?.name || "Player B";
        scoreLeft = battle.round_count > 1 ? oppWins : oppTotalCrowns;
        scoreRight = battle.round_count > 1 ? teamWins : teamTotalCrowns;
      }

      return {
        ...link,
        battle_time: battle.battle_time,
        api_game_mode: battle.api_game_mode,
        api_battle_type: battle.api_battle_type,
        round_count: battle.round_count,
        titleLeft,
        titleRight,
        scoreLeft,
        scoreRight,
        teamLeft: teamsByPlayerId[playerAId],
        teamRight: teamsByPlayerId[playerBId],
      };
    });

    setLinkedBattles(enrichedData);
  }

  async function loadAvailableBattles(playerAId, playerBId, fromTime, toTime, scheduledMatchId = null) {
    if (!playerAId || !playerBId) {
      setAvailableBattles([]);
      return;
    }

    setLoadingBattles(true);

    try {
      // Get zone_id from scheduled match
      let zoneId = null;
      if (scheduledMatchId) {
        const { data: matchInfo } = await supabase
          .from("scheduled_match")
          .select("zone_id")
          .eq("scheduled_match_id", scheduledMatchId)
          .single();
        zoneId = matchInfo?.zone_id;
      }

      // Get already linked battles to exclude them
      let alreadyLinked = [];
      if (scheduledMatchId) {
        const { data: linked } = await supabase
          .from("scheduled_match_battle_link")
          .select("battle_id")
          .eq("scheduled_match_id", scheduledMatchId);
        alreadyLinked = (linked || []).map(l => l.battle_id);
      }

      // Get battle_round_player records for both players
      let query = supabase
        .from("battle_round_player")
        .select("battle_round_id, player_id");

      query = query.or(`player_id.eq.${playerAId},player_id.eq.${playerBId}`);

      const { data: brp, error: e1 } = await query.limit(5000);
      if (e1) throw e1;

      // Group by battle_round_id and find rounds where both players participated
      const roundsByBattle = {};
      (brp || []).forEach(record => {
        if (!roundsByBattle[record.battle_round_id]) {
          roundsByBattle[record.battle_round_id] = new Set();
        }
        roundsByBattle[record.battle_round_id].add(record.player_id);
      });

      // Filter to rounds where both players participated
      const validRoundIds = Object.entries(roundsByBattle)
        .filter(([_, playerSet]) => playerSet.has(playerAId) && playerSet.has(playerBId))
        .map(([roundId, _]) => roundId);

      if (validRoundIds.length === 0) {
        setAvailableBattles([]);
        setLoadingBattles(false);
        return;
      }

      // Get battle_round to map to battle_id
      const { data: rounds, error: e2 } = await supabase
        .from("battle_round")
        .select("battle_round_id, battle_id, round_no")
        .in("battle_round_id", validRoundIds);

      if (e2) throw e2;

      const battleIds = [...new Set((rounds || []).map(r => r.battle_id))];

      if (battleIds.length === 0) {
        setAvailableBattles([]);
        setLoadingBattles(false);
        return;
      }

      // Get battle details with time filter
      let battleQuery = supabase
        .from("battle")
        .select("battle_id, battle_time, api_game_mode, api_battle_type, round_count")
        .in("battle_id", battleIds)
        .order("battle_time", { ascending: false });

      if (fromTime) battleQuery = battleQuery.gte("battle_time", fromTime);
      if (toTime) battleQuery = battleQuery.lte("battle_time", toTime);

      const { data: battles, error: e3 } = await battleQuery;
      if (e3) throw e3;

      // Get round player details for these battles
      const battleRoundIds = (rounds || [])
        .filter(r => battles?.some(b => b.battle_id === r.battle_id))
        .map(r => r.battle_round_id);

      const { data: roundPlayers, error: e4 } = await supabase
        .from("battle_round_player")
        .select("battle_round_id, player_id, side, crowns, opponent_crowns")
        .in("battle_round_id", battleRoundIds);

      if (e4) throw e4;

      // Get player names
      const { data: playerData, error: e5 } = await supabase
        .from("player")
        .select("player_id, name, nick")
        .in("player_id", [playerAId, playerBId]);

      if (e5) throw e5;

      const playersById = {};
      (playerData || []).forEach(p => playersById[p.player_id] = p);

      // Get team assignments
      const { data: teamAssignments } = await supabase
        .from("season_zone_team_player")
        .select("player_id, team_id, team:team(team_id, name, logo)")
        .eq("zone_id", zoneId)
        .in("player_id", [playerAId, playerBId]);

      const teamsByPlayerId = {};
      (teamAssignments || []).forEach(ta => {
        if (ta.team) teamsByPlayerId[ta.player_id] = ta.team;
      });

      // Combine data: for each battle, compute result
      const battlesWithResults = (battles || []).map(battle => {
        const battleRounds = (rounds || []).filter(r => r.battle_id === battle.battle_id);
        const roundNos = [...new Set(battleRounds.map(r => r.round_no))].sort((a, b) => a - b);

        let teamWins = 0;
        let oppWins = 0;
        let teamTotalCrowns = 0;
        let oppTotalCrowns = 0;

        roundNos.forEach(rn => {
          const roundIds = battleRounds.filter(r => r.round_no === rn).map(r => r.battle_round_id);
          const roundPlayerData = (roundPlayers || []).filter(rp => roundIds.includes(rp.battle_round_id));

          const teamData = roundPlayerData.filter(rp => rp.side === "TEAM");
          const oppData = roundPlayerData.filter(rp => rp.side === "OPPONENT");

          const teamCrowns = teamData.reduce((sum, rp) => sum + (rp.crowns || 0), 0);
          const oppCrowns = teamData.reduce((sum, rp) => sum + (rp.opponent_crowns || 0), 0) +
            oppData.reduce((sum, rp) => sum + (rp.crowns || 0), 0);

          teamTotalCrowns += teamCrowns;
          oppTotalCrowns += oppCrowns;

          if (teamCrowns > oppCrowns) teamWins++;
          else if (oppCrowns > teamCrowns) oppWins++;
        });

        // Find which player is TEAM and which is OPPONENT in this battle
        const battleRoundIds = battleRounds.map(r => r.battle_round_id);
        const teamPlayer = (roundPlayers || []).find(rp =>
          battleRoundIds.includes(rp.battle_round_id) &&
          rp.side === "TEAM" &&
          (rp.player_id === playerAId || rp.player_id === playerBId)
        );

        // playerA should always be shown on the left
        let titleLeft, titleRight, scoreLeft, scoreRight;

        if (teamPlayer?.player_id === playerAId) {
          // playerA is TEAM, playerB is OPPONENT
          titleLeft = playersById[playerAId]?.nick || playersById[playerAId]?.name || "Player A";
          titleRight = playersById[playerBId]?.nick || playersById[playerBId]?.name || "Player B";
          scoreLeft = battle.round_count > 1 ? teamWins : teamTotalCrowns;
          scoreRight = battle.round_count > 1 ? oppWins : oppTotalCrowns;
        } else {
          // playerA is OPPONENT, playerB is TEAM (inverted)
          titleLeft = playersById[playerAId]?.nick || playersById[playerAId]?.name || "Player A";
          titleRight = playersById[playerBId]?.nick || playersById[playerBId]?.name || "Player B";
          scoreLeft = battle.round_count > 1 ? oppWins : oppTotalCrowns;
          scoreRight = battle.round_count > 1 ? teamWins : teamTotalCrowns;
        }

        return {
          ...battle,
          titleLeft,
          titleRight,
          scoreLeft,
          scoreRight,
          teamLeft: teamsByPlayerId[playerAId],
          teamRight: teamsByPlayerId[playerBId],
        };
      });

      // Filter out already linked battles
      const filteredBattles = battlesWithResults.filter(b => !alreadyLinked.includes(b.battle_id));

      // Sort by battle_time descending (most recent first)
      filteredBattles.sort((a, b) => {
        const dateA = new Date(a.battle_time);
        const dateB = new Date(b.battle_time);
        return dateB - dateA;
      });

      setAvailableBattles(filteredBattles);
    } catch (error) {
      console.error("Error loading available battles:", error);
      setAvailableBattles([]);
    } finally {
      setLoadingBattles(false);
    }
  }

  async function linkBattle(battleId) {
    console.log("linkBattle called with battleId:", battleId);
    console.log("matchData:", matchData);
    console.log("user:", user);
    
    if (!matchData?.scheduled_match_id) {
      console.error("Missing matchData", { matchData });
      alert("Error: Falta información del partido");
      return;
    }

    if (!battleId) {
      console.error("Missing battleId");
      alert("Error: ID de batalla inválido");
      return;
    }

    setLinkingBattle(battleId);

    try {
      const { error } = await supabase
        .from("scheduled_match_battle_link")
        .insert({
          scheduled_match_id: matchData.scheduled_match_id,
          battle_id: battleId,
          linked_by_admin: user?.id || null,
          linked_by_player: null
        });

      if (error) {
        console.error("Error linking battle:", error);
        alert("Error al vincular batalla: " + error.message);
        return;
      }

      console.log("Battle linked successfully");

      // Reload battles
      await loadLinkedBattles(matchData.scheduled_match_id);
      await loadAvailableBattles(
        matchData.player_a_id || matchData.player_a?.player_id,
        matchData.player_b_id || matchData.player_b?.player_id,
        matchData.scheduled_from,
        matchData.scheduled_to,
        matchData.scheduled_match_id
      );

      // Recalculate suggested result
      const suggested = await calculateSuggestedResult(
        matchData.scheduled_match_id,
        matchData.season_id,
        matchData.competition_id,
        matchData.stage
      );

      if (suggested) {
        setManualResult({
          final_score_a: suggested.scoreA ?? "",
          final_score_b: suggested.scoreB ?? "",
          points_a: suggested.pointsA ?? "",
          points_b: suggested.pointsB ?? "",
          decided_by: "ADMIN"
        });
      }
    } catch (err) {
      console.error("Exception in linkBattle:", err);
      alert("Error inesperado: " + err.message);
    } finally {
      setLinkingBattle(null);
    }
  }

  async function unlinkBattle(battleId) {
    if (!matchData?.scheduled_match_id) return;

    const { error } = await supabase
      .from("scheduled_match_battle_link")
      .delete()
      .eq("scheduled_match_id", matchData.scheduled_match_id)
      .eq("battle_id", battleId);

    if (error) {
      console.error("Error unlinking battle:", error);
      alert("Error al desvincular batalla: " + error.message);
      return;
    }

    // Reload battles
    await loadLinkedBattles(matchData.scheduled_match_id);
    await loadAvailableBattles(
      matchData.player_a_id || matchData.player_a?.player_id,
      matchData.player_b_id || matchData.player_b?.player_id,
      matchData.scheduled_from,
      matchData.scheduled_to,
      matchData.scheduled_match_id
    );

    // Recalculate suggested result
    const suggested = await calculateSuggestedResult(
      matchData.scheduled_match_id,
      matchData.season_id,
      matchData.competition_id,
      matchData.stage
    );

    if (suggested) {
      setManualResult({
        final_score_a: suggested.scoreA ?? "",
        final_score_b: suggested.scoreB ?? "",
        points_a: suggested.pointsA ?? "",
        points_b: suggested.pointsB ?? "",
        decided_by: "ADMIN"
      });
    }
  }

  async function setManualResultForMatch() {
    if (!matchData?.scheduled_match_id) return;

    setSaving(true);

    try {
      // Upsert result
      const { error: resultError } = await supabase
        .from("scheduled_match_result")
        .upsert({
          scheduled_match_id: matchData.scheduled_match_id,
          final_score_a: parseInt(manualResult.final_score_a) || 0,
          final_score_b: parseInt(manualResult.final_score_b) || 0,
          points_a: parseInt(manualResult.points_a) || 0,
          points_b: parseInt(manualResult.points_b) || 0,
          decided_by: manualResult.decided_by || "ADMIN"
        }, {
          onConflict: "scheduled_match_id"
        });

      if (resultError) throw resultError;

      // Update match scores
      const { error: matchError } = await supabase
        .from("scheduled_match")
        .update({
          score_a: parseInt(manualResult.final_score_a) || 0,
          score_b: parseInt(manualResult.final_score_b) || 0,
          result_overridden: true,
          status: "OVERRIDDEN"
        })
        .eq("scheduled_match_id", matchData.scheduled_match_id);

      if (matchError) throw matchError;

      alert("Resultado guardado correctamente");
      if (onSaved) onSaved();
      onClose();
    } catch (error) {
      console.error("Error saving result:", error);
      alert("Error al guardar resultado");
    } finally {
      setSaving(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="w-full max-w-4xl rounded-2xl border border-white/10 bg-[#0a0f1b] overflow-hidden max-h-[90vh] flex flex-col">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold">
              Editar Partido - {editPlayerNames.playerA} vs {editPlayerNames.playerB}
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-10 w-10 flex items-center justify-center text-white/70 hover:text-white rounded-xl hover:bg-white/10 transition"
          >
            ✕
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          {/* Linked Battles */}
          <div className="mb-6">
            <div className="text-sm font-semibold mb-2">Batallas Vinculadas</div>
            {linkedBattles.length === 0 ? (
              <div className="text-sm text-white/60">No hay batallas vinculadas</div>
            ) : (
              <div className="space-y-2">
                {linkedBattles.map((link) => {
                  const winnerLeft = link.scoreLeft > link.scoreRight;
                  const winnerRight = link.scoreRight > link.scoreLeft;

                  return (
                    <div key={link.battle_id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <div className="flex flex-col gap-2 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="rounded-lg bg-slate-900/60 px-2 py-1">
                            <div className="text-[10px] text-white/50">Fecha</div>
                            <div className="text-xs">{link.battle_time ? new Date(link.battle_time).toLocaleDateString('es-ES') : "—"}</div>
                          </div>
                          <div className="rounded-lg bg-slate-900/60 px-2 py-1">
                            <div className="text-[10px] text-white/50">Modo</div>
                            <div className="text-xs">{link.api_game_mode || "—"}</div>
                          </div>
                          <div className="rounded-lg bg-slate-900/60 px-2 py-1">
                            <div className="text-[10px] text-white/50">Tipo</div>
                            <div className="text-xs">{link.api_battle_type || "—"}</div>
                          </div>
                          {link.linked_by_admin && (
                            <span className="text-xs px-2 py-1 rounded-lg bg-blue-500/20 border border-blue-500/30 text-blue-200">
                              🔗 Admin
                            </span>
                          )}
                          {link.linked_by_player && (
                            <span className="text-xs px-2 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-200">
                              🔗 Jugador
                            </span>
                          )}
                        </div>

                        {link.titleLeft && link.titleRight && (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-2">
                                {link.teamLeft?.logo && (
                                  <img src={link.teamLeft.logo} alt={link.teamLeft.name} className="w-5 h-5 rounded-full object-cover" />
                                )}
                                <span className={winnerLeft ? "text-emerald-400 font-semibold" : "text-white/80"}>
                                  {link.titleLeft}
                                </span>
                              </div>
                              <span className="text-white/40">vs</span>
                              <div className="flex items-center gap-2">
                                {link.teamRight?.logo && (
                                  <img src={link.teamRight.logo} alt={link.teamRight.name} className="w-5 h-5 rounded-full object-cover" />
                                )}
                                <span className={winnerRight ? "text-emerald-400 font-semibold" : "text-white/80"}>
                                  {link.titleRight}
                                </span>
                              </div>
                            </div>
                            <div className="text-sm font-mono">
                              <span className={winnerLeft ? "text-emerald-400 font-semibold" : "text-white/70"}>
                                {link.scoreLeft}
                              </span>
                              {" - "}
                              <span className={winnerRight ? "text-emerald-400 font-semibold" : "text-white/70"}>
                                {link.scoreRight}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-white/10">
                        <div className="text-xs text-white/50 font-mono">{link.battle_id}</div>
                        <button
                          onClick={() => unlinkBattle(link.battle_id)}
                          className="rounded-lg px-3 py-1 bg-rose-500/15 hover:bg-rose-500/20 border border-rose-500/30 text-rose-100 text-xs font-semibold transition"
                        >
                          Desvincular
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Available Battles */}
          <div className="mb-6">
            <div className="text-sm font-semibold mb-2">Batallas Disponibles</div>
            {loadingBattles ? (
              <div className="text-sm text-white/60">Cargando...</div>
            ) : availableBattles.length === 0 ? (
              <div className="text-sm text-white/60">No hay batallas disponibles entre estos jugadores en la ventana de tiempo</div>
            ) : (
              <div className="max-h-64 overflow-y-auto space-y-2">
                {availableBattles.map((battle) => {
                  const winnerLeft = battle.scoreLeft > battle.scoreRight;
                  const winnerRight = battle.scoreRight > battle.scoreLeft;

                  return (
                    <div key={battle.battle_id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <div className="flex flex-col gap-2 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="rounded-lg bg-slate-900/60 px-2 py-1">
                            <div className="text-[10px] text-white/50">Fecha</div>
                            <div className="text-xs">{new Date(battle.battle_time).toLocaleDateString('es-ES')}</div>
                          </div>
                          <div className="rounded-lg bg-slate-900/60 px-2 py-1">
                            <div className="text-[10px] text-white/50">Modo</div>
                            <div className="text-xs">{battle.api_game_mode || "—"}</div>
                          </div>
                          <div className="rounded-lg bg-slate-900/60 px-2 py-1">
                            <div className="text-[10px] text-white/50">Tipo</div>
                            <div className="text-xs">{battle.api_battle_type || "—"}</div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-2">
                              {battle.teamLeft?.logo && (
                                <img src={battle.teamLeft.logo} alt={battle.teamLeft.name} className="w-5 h-5 rounded-full object-cover" />
                              )}
                              <span className={winnerLeft ? "text-emerald-400 font-semibold" : "text-white/80"}>
                                {battle.titleLeft}
                              </span>
                            </div>
                            <span className="text-white/40">vs</span>
                            <div className="flex items-center gap-2">
                              {battle.teamRight?.logo && (
                                <img src={battle.teamRight.logo} alt={battle.teamRight.name} className="w-5 h-5 rounded-full object-cover" />
                              )}
                              <span className={winnerRight ? "text-emerald-400 font-semibold" : "text-white/80"}>
                                {battle.titleRight}
                              </span>
                            </div>
                          </div>
                          <div className="text-sm font-semibold">
                            <span className={winnerLeft ? "text-emerald-400" : "text-white/80"}>{battle.scoreLeft}</span>
                            <span className="mx-1 text-white/40">-</span>
                            <span className={winnerRight ? "text-emerald-400" : "text-white/80"}>{battle.scoreRight}</span>
                            <span className="ml-1 text-[10px] text-white/40">
                              {battle.round_count > 1 ? "(rondas)" : "(coronas)"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-white/10">
                        <div className="text-xs text-white/50 font-mono">{battle.battle_id}</div>
                        <button
                          onClick={() => {
                            console.log("Button clicked for battle:", battle.battle_id);
                            linkBattle(battle.battle_id);
                          }}
                          disabled={linkingBattle === battle.battle_id}
                          className="rounded-lg px-3 py-1 bg-emerald-500/15 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-100 text-xs font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {linkingBattle === battle.battle_id ? "Vinculando..." : "Vincular"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Manual Result */}
          <div className="border-t border-white/10 pt-4">
            <div className="text-lg font-semibold mb-3">Establecer Resultado Manual</div>

            <div className="mb-4 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
              <div className="text-xs text-blue-200 font-semibold mb-1">Puntaje del Partido (Batallas ganadas)</div>
              <div className="text-xs text-blue-200/70">Ej: 2-0, 2-1, 1-2, 0-2</div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <div className="text-sm text-white/70 mb-2">Puntaje {editPlayerNames.playerA || "Jugador A"}</div>
                <input
                  type="number"
                  min="0"
                  value={manualResult.final_score_a}
                  onChange={(e) => setManualResult(prev => ({ ...prev, final_score_a: e.target.value }))}
                  className="w-full rounded-xl bg-[#0b1220] border border-white/10 px-3 py-2.5 outline-none focus:border-white/20"
                  placeholder="0"
                />
              </div>
              <div>
                <div className="text-sm text-white/70 mb-2">Puntaje {editPlayerNames.playerB || "Jugador B"}</div>
                <input
                  type="number"
                  min="0"
                  value={manualResult.final_score_b}
                  onChange={(e) => setManualResult(prev => ({ ...prev, final_score_b: e.target.value }))}
                  className="w-full rounded-xl bg-[#0b1220] border border-white/10 px-3 py-2.5 outline-none focus:border-white/20"
                  placeholder="0"
                />
              </div>
            </div>

            <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <div className="text-xs text-emerald-200 font-semibold mb-1">Puntos para la Tabla</div>
              <div className="text-xs text-emerald-200/70">Según points_schema de la configuración</div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <div className="text-sm text-white/70 mb-2">Puntos {editPlayerNames.playerA || "Jugador A"}</div>
                <input
                  type="number"
                  min="0"
                  value={manualResult.points_a}
                  onChange={(e) => setManualResult(prev => ({ ...prev, points_a: e.target.value }))}
                  className="w-full rounded-xl bg-[#0b1220] border border-white/10 px-3 py-2.5 outline-none focus:border-white/20"
                  placeholder="Automático"
                />
              </div>
              <div>
                <div className="text-sm text-white/70 mb-2">Puntos {editPlayerNames.playerB || "Jugador B"}</div>
                <input
                  type="number"
                  min="0"
                  value={manualResult.points_b}
                  onChange={(e) => setManualResult(prev => ({ ...prev, points_b: e.target.value }))}
                  className="w-full rounded-xl bg-[#0b1220] border border-white/10 px-3 py-2.5 outline-none focus:border-white/20"
                  placeholder="Automático"
                />
              </div>
            </div>

            <button
              onClick={setManualResultForMatch}
              disabled={saving}
              className="w-full rounded-xl px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 transition font-semibold text-blue-100 disabled:opacity-50"
            >
              {saving ? "Guardando..." : "Guardar Resultado"}
            </button>
          </div>
        </div>

        <div className="p-4 border-t border-white/10 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 transition font-semibold"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
