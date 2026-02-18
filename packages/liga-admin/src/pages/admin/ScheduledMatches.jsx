import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import BattleDetailModal from "../../components/BattleDetailModal";

const emptyForm = {
  scheduled_match_id: null,  
  zone_id: "",
  competition_id: "",
  competition_stage_id: "",
  competition_group_id: "",
  type: "CUP_MATCH",
  stage: "CUP_QUALY",
  best_of: 3,
  expected_team_size: 1,
  player_a_id: "",
  player_b_id: "",
  day_no: null,
  scheduled_from: "",
  scheduled_to: "",
  deadline_at: "",
  status: "PENDING",
};

const SCHEDULED_MATCH_SELECT = `
  scheduled_match_id,
  season_id,
  zone_id,
  competition_id,
  competition_stage_id,
  competition_group_id,
  type,
  stage,
  best_of,
  expected_team_size,
  player_a_id,
  player_b_id,
  scheduled_from,
  scheduled_to,
  deadline_at,
  status,
  score_a,
  score_b,
  result_overridden,
  created_at,
  updated_at,

  competition:competition!scheduled_match_competition_id_fkey (
    competition_id,
    name    
  ),

  competition_group:competition_group!scheduled_match_competition_group_id_fkey (
    competition_group_id,
    code,
    name
  ),

  player_a_id:player!scheduled_match_player_a_id_fkey (
    player_id,
    name,
    nick
  ),

  player_b_id:player!scheduled_match_player_b_id_fkey (
    player_id,
    name,
    nick
  ),

  linked_battles:scheduled_match_battle_link (
    battle_id
  )
`;
function cls(...arr) {
  return arr.filter(Boolean).join(" ");
}

function toInputValue(ts) {
  // ts = timestamptz string
  if (!ts) return "";
  // Keep it simple: show as-is if already "YYYY-MM-DDTHH:mm"
  // Supabase often returns ISO. We'll slice.
  try {
    const d = new Date(ts);
    const pad = (n) => String(n).padStart(2, "0");
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const mi = pad(d.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
  } catch {
    return "";
  }
}

function fromInputValue(v) {
  // datetime-local -> ISO
  if (!v) return null;
  try {
    return new Date(v).toISOString();
  } catch {
    return null;
  }
}

function formatDateOnly(ts) {
  if (!ts) return "—";
  try {
    const d = new Date(ts);
    return d.toLocaleDateString("es-AR");
  } catch {
    return "—";
  }
}

function formatTimeRemaining(ts, nowMs) {
  if (!ts) return "";
  const target = new Date(ts).getTime();
  if (Number.isNaN(target)) return "";
  let diff = target - nowMs;

  const abs = Math.abs(diff);
  const totalMinutes = Math.floor(abs / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes - days * 60 * 24) / 60);
  const minutes = totalMinutes - days * 60 * 24 - hours * 60;

  const parts = [];
  if (days) parts.push(`${days} día${days === 1 ? "" : "s"}`);
  if (hours || days) parts.push(`${hours} hora${hours === 1 ? "" : "s"}`);
  if (!days && minutes) parts.push(`${minutes} min`);

  const txt = parts.join(", ") || "0 min";
  return diff >= 0 ? txt : `vencido hace ${txt}`;
}

function formatDeadline(ts, nowMs) {
  if (!ts) return "—";
  const date = formatDateOnly(ts);
  const rem = formatTimeRemaining(ts, nowMs);
  return rem ? `${date} (${rem})` : date;
}

export default function ScheduledMatches() {
  const nav = useNavigate();
  const { user } = useAuth();
  
  const { seasonId: seasonParam } = useParams();
  const seasonId = seasonParam || "";
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [seasons, setSeasons] = useState([]);
  const [zones, setZones] = useState([]);
  const [competitions, setCompetitions] = useState([]);
  const competitionId = competitions[0]?.competition_id || "";
  const [stages, setStages] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loadingStages, setLoadingStages] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(false);
  
  const [players, setPlayers] = useState([]);

  const [selectedZoneId, setSelectedZoneId] = useState("");

  const [rows, setRows] = useState([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  
  // Battle detail modal
  const [battleModalOpen, setBattleModalOpen] = useState(false);
  const [selectedBattleId, setSelectedBattleId] = useState(null);
  
  // Battle linking and results
  const [linkedBattles, setLinkedBattles] = useState([]);
  const [availableBattles, setAvailableBattles] = useState([]);
  const [loadingBattles, setLoadingBattles] = useState(false);
  const [manualResult, setManualResult] = useState({ final_score_a: "", final_score_b: "", points_a: "", points_b: "", decided_by: "ADMIN" });
  const [editPlayerNames, setEditPlayerNames] = useState({ playerA: "", playerB: "" });

    // Bulk create modal
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [nowTs, setNowTs] = useState(Date.now());

  useEffect(() => {
  const t = setInterval(() => setNowTs(Date.now()), 60 * 1000);
  return () => clearInterval(t);
  }, []);

  const bulkEmpty = {
    season_id: "",
    zone_id: "",
    competition_id: "",
    competition_stage_id: "",
    competition_group_id: "",
    best_of: 3,
    scheduled_from: "",
    scheduled_to: "",
    deadline_at: "",
    // lista de batallas a crear
    items: [{ player_a_id: "", player_b_id: "" }],
  };
  const [bulkForm, setBulkForm] = useState({ ...bulkEmpty });

  const [bulkStages, setBulkStages] = useState([]);
  const [bulkLoadingStages, setBulkLoadingStages] = useState(false);
  const [bulkGroups, setBulkGroups] = useState([]);
  const [bulkLoadingGroups, setBulkLoadingGroups] = useState(false);


  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let filtered = rows;
    
    // Filter by status
    if (statusFilter && statusFilter !== "ALL") {
      filtered = filtered.filter(r => r.status === statusFilter);
    }
    
    // Filter by date from
    if (dateFrom) {
      const fromDate = new Date(dateFrom + "T00:00:00");
      filtered = filtered.filter(r => {
        if (!r.scheduled_from) return false;
        const matchDate = new Date(r.scheduled_from);
        return matchDate >= fromDate;
      });
    }
    
    // Filter by date to
    if (dateTo) {
      const toDate = new Date(dateTo + "T23:59:59.999");
      filtered = filtered.filter(r => {
        if (!r.scheduled_from) return false;
        const matchDate = new Date(r.scheduled_from);
        return matchDate <= toDate;
      });
    }
    
    // Filter by search query
    if (q) {
      filtered = filtered.filter((r) => {
        const a = (r.player_a_id?.name || r.player_a_id?.nick || "").toLowerCase();
        const b = (r.player_b_id?.name || r.player_b_id?.nick || "").toLowerCase();
        const opp = (r.opponent_name || "").toLowerCase();
        const c = (r.competition?.name || "").toLowerCase();
        const st = (r.stage || "").toLowerCase();
        const group = (r.competition_group?.name || "").toLowerCase();
        const groupCode = (r.competition_group?.code || "").toLowerCase();
        return a.includes(q) || b.includes(q) || opp.includes(q) || c.includes(q) || st.includes(q) || group.includes(q) || groupCode.includes(q);
      });
    }
    
    return filtered;
  }, [rows, query, statusFilter, dateFrom, dateTo]);

async function fetchStagesForCompetitionBulk(compId) {
    if (!compId) {
      setBulkStages([]);
      return;
    }
    setBulkLoadingStages(true);
    const { data, error } = await supabase
      .from("competition_stage")
      .select("competition_stage_id, stage")
      .eq("competition_id", compId)
      .order("stage_order", { ascending: true });

    setBulkLoadingStages(false);

    if (error) {
      console.error("Error loading bulk stages:", error);
      setBulkStages([]);
      return;
    }

    setBulkStages(data || []);
  }

  async function fetchGroupsForStageBulk(stageId) {
    if (!stageId) {
      setBulkGroups([]);
      return;
    }

    setBulkLoadingGroups(true);
    const { data, error } = await supabase
      .from("competition_group")
      .select("competition_group_id, code, name, competition_stage_id")
      .eq("competition_stage_id", stageId)
      .order("code", { ascending: true });

    setBulkLoadingGroups(false);

    if (error) {
      console.error("Error loading bulk groups:", error);
      setBulkGroups([]);
      return;
    }

    setBulkGroups(data || []);
  }

  async function fetchGroupsForStageBulk(stageId) {
    if (!stageId) {
      setBulkGroups([]);
      return;
    }

    setBulkLoadingGroups(true);
    const { data, error } = await supabase
      .from("competition_group")
      .select("competition_group_id, code, name, competition_stage_id")
      .eq("competition_stage_id", stageId)
      .order("code", { ascending: true });

    setBulkLoadingGroups(false);

    if (error) {
      console.error("Error loading bulk groups:", error);
      setBulkGroups([]);
      return;
    }

    setBulkGroups(data || []);
  }

  async function fetchGroupsForStageBulk(stageId) {
    if (!stageId) {
      setBulkGroups([]);
      return;
    }

    setBulkLoadingGroups(true);
    const { data, error } = await supabase
      .from("competition_group")
      .select("competition_group_id, code, name, competition_stage_id")
      .eq("competition_stage_id", stageId)
      .order("code", { ascending: true });

    setBulkLoadingGroups(false);

    if (error) {
      console.error("Error loading bulk groups:", error);
      setBulkGroups([]);
      return;
    }

    setBulkGroups(data || []);
  }
async function fetchStagesForCompetition(competitionId) {
  if (!competitionId) {
    setStages([]);
    return;
  }

  setLoadingStages(true);
  const { data, error } = await supabase
    .from("competition_stage")
    .select("competition_stage_id, stage")
    .eq("competition_id", competitionId)
    .order("stage_order", { ascending: true });

  setLoadingStages(false);

  if (error) {
    console.error("Error loading stages:", error);
    setStages([]);
    return;
  }

  setStages(data || []);
}

async function fetchGroupsForStage(stageId) {
  if (!stageId) {
    setGroups([]);
    return;
  }

  setLoadingGroups(true);
  const { data, error } = await supabase
    .from("competition_group")
    .select("competition_group_id, code, name, competition_stage_id")
    .eq("competition_stage_id", stageId)
    .order("code", { ascending: true });

  setLoadingGroups(false);

  if (error) {
    console.error("Error loading groups:", error);
    setGroups([]);
    return;
  }

  setGroups(data || []);
}

  useEffect(() => {
    (async () => {
      setLoading(true);

      // Seasons
      const sRes = await supabase
        .from("season")
        .select("season_id, description, duel_start_date, ladder_start_date, created_at")
        .order("created_at", { ascending: false });

      if (sRes.error) {
        console.error(sRes.error);
        setLoading(false);
        return;
      }
      setSeasons(sRes.data || []);

      // Competitions (Copa de Liga, Revenge, etc.)
      const cRes = await supabase
        .from("competition")
        .select("competition_id, name, logo")        
        .order("name", { ascending: true });

      if (!cRes.error) setCompetitions(cRes.data || []);      

      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!seasonId) return;

    (async () => {
      // Zones for season
      const zRes = await supabase
        .from("season_zone")
        .select("zone_id, season_id, name, zone_order, created_at, last_snapshot_at")
        .eq("season_id", seasonId)
        .order("zone_order", { ascending: true });

      if (zRes.error) {
        console.error(zRes.error);
        setZones([]);
        return;
      }
      setZones(zRes.data || []);

      const firstZone = (zRes.data || [])[0];
      setSelectedZoneId(firstZone?.zone_id || "");
    })();
  }, [seasonId]);

  useEffect(() => {
    if (!seasonId || !selectedZoneId) {
      setRows([]);
      setPlayers([]);
      return;
    }

    (async () => {
      setLoading(true);

      // List scheduled matches
      const rRes = await supabase
        .from("scheduled_match")
        .select(SCHEDULED_MATCH_SELECT)
        .eq("season_id", seasonId)
        .eq("zone_id", selectedZoneId)
        .order("created_at", { ascending: false });

      if (rRes.error) {
        console.error(rRes.error);
        setRows([]);
      } else {
        // Enriquecer rows con nombres de oponentes para CW_DAILY
        const enrichedRows = await enrichRowsWithOpponents(rRes.data || []);
        setRows(enrichedRows);
      }

      // Load ALL players (including inactive ones) ordered by nick
      const pRes = await supabase
        .from("player")
        .select("player_id, name, nick")
        .order("nick", { ascending: true });

      if (pRes.error) {
        console.error(pRes.error);
        setPlayers([]);
      } else {
        setPlayers(pRes.data || []);
      }
      
      setLoading(false);
    })();
  }, [seasonId, selectedZoneId]);

  useEffect(() => {
  let alive = true;

 

  // IMPORTANTE:
  // resetea stage/group cuando cambia competition para evitar IDs “colgados”
  // (si tenés modal de edición, esto evita inconsistencias)
  setForm((prev) => ({
    ...prev,
    competition_stage_id: null,
    competition_group_id: null,
  }));

  
  return () => {
    alive = false;
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.competition_id]);

  async function enrichRowsWithOpponents(rows) {
    // Para partidos CW_DAILY sin player_b_id, obtener nombre del oponente
    const cwDailyRows = rows.filter(r => r.type === "CW_DAILY" && !r.player_b_id);
    
    console.log(`[enrichRowsWithOpponents] Found ${cwDailyRows.length} CW_DAILY rows without player_b_id`);
    
    if (cwDailyRows.length === 0) return rows;

    // Dividir en lotes de 100 para evitar URLs demasiado largas
    const batchSize = 100;
    const matchOpponents = {};
    
    for (let i = 0; i < cwDailyRows.length; i += batchSize) {
      const batch = cwDailyRows.slice(i, i + batchSize);
      const matchIds = batch.map(r => r.scheduled_match_id);
      
      console.log(`[enrichRowsWithOpponents] Processing batch ${Math.floor(i/batchSize) + 1}, ${matchIds.length} IDs`);

      // Obtener batallas vinculadas
      const { data: links, error: linksError } = await supabase
        .from("scheduled_match_battle_link")
        .select("scheduled_match_id, battle_id")
        .in("scheduled_match_id", matchIds);

      if (linksError) {
        console.error("[enrichRowsWithOpponents] Error loading links:", linksError);
        continue;
      }

      if (!links || links.length === 0) {
        console.log(`[enrichRowsWithOpponents] No links found for batch`);
        continue;
      }

      console.log(`[enrichRowsWithOpponents] Found ${links.length} links`);

      const battleIds = links.map(l => l.battle_id);

      // Obtener rounds
      const { data: battleRounds, error: roundsError } = await supabase
        .from("battle_round")
        .select("battle_round_id, battle_id")
        .in("battle_id", battleIds);

      if (roundsError) {
        console.error("[enrichRowsWithOpponents] Error loading rounds:", roundsError);
        continue;
      }

      if (!battleRounds || battleRounds.length === 0) continue;

      // Obtener datos de jugadores incluyendo opponent
      const roundIds = battleRounds.map(r => r.battle_round_id);
      const { data: roundPlayers, error: playersError } = await supabase
        .from("battle_round_player")
        .select("battle_round_id, side, opponent")
        .in("battle_round_id", roundIds)
        .eq("side", "TEAM");

      if (playersError) {
        console.error("[enrichRowsWithOpponents] Error loading players:", playersError);
        continue;
      }

      if (!roundPlayers || roundPlayers.length === 0) continue;

      // Mapear battle_id -> opponent_name
      const battleOpponents = {};
      battleRounds.forEach(br => {
        const rp = roundPlayers.find(r => r.battle_round_id === br.battle_round_id);
        if (rp && rp.opponent) {
          const opponentData = Array.isArray(rp.opponent) ? rp.opponent[0] : rp.opponent;
          battleOpponents[br.battle_id] = opponentData?.name || opponentData?.tag || "Oponente";
        }
      });

      // Mapear scheduled_match_id -> opponent_name
      links.forEach(link => {
        if (battleOpponents[link.battle_id]) {
          matchOpponents[link.scheduled_match_id] = battleOpponents[link.battle_id];
        }
      });
    }

    console.log(`[enrichRowsWithOpponents] Total opponents found: ${Object.keys(matchOpponents).length}`);

    // Enriquecer rows
    const enrichedRows = rows.map(r => {
      if (r.type === "CW_DAILY" && !r.player_b_id && matchOpponents[r.scheduled_match_id]) {
        return {
          ...r,
          opponent_name: matchOpponents[r.scheduled_match_id]
        };
      }
      return r;
    });
    
    return enrichedRows;
  }

  function openCreate() {
    setForm({
      ...emptyForm,
      season_id: seasonId || "",
      zone_id: selectedZoneId || "",
    });
    setLinkedBattles([]);
    setAvailableBattles([]);
    setManualResult({ final_score_a: "", final_score_b: "", points_a: "", points_b: "", decided_by: "ADMIN" });
    setOpen(true);
  }

  async function openEdit(row) {
    setForm({
      scheduled_match_id: row.scheduled_match_id,
      season_id: row.season_id,
      zone_id: row.zone_id,
      competition_id: row.competition_id || "",
      competition_stage_id: row.competition_stage_id || "",
      competition_group_id: row.competition_group_id || "",
      type: row.type || "CUP_MATCH",
      stage: row.stage || "CUP_QUALY",
      best_of: row.best_of ?? 3,
      expected_team_size: row.expected_team_size ?? 1,
      player_a_id: row.player_a_id || "",
      player_b_id: row.player_b_id || "",
      scheduled_from: toInputValue(row.scheduled_from),
      scheduled_to: toInputValue(row.scheduled_to),
      deadline_at: toInputValue(row.deadline_at),
      status: row.status || "PENDING",
      score_a: row.score_a ?? null,
      score_b: row.score_b ?? null,
      result_overridden: !!row.result_overridden,
      day_no: row.day_no ?? null,
    });
    
    // Set player names for title
    setEditPlayerNames({
      playerA: row.player_a_id?.nick || row.player_a_id?.name || "Jugador A",
      playerB: row.player_b_id?.nick || row.player_b_id?.name || "Jugador B"
    });
    
    // Load battles data asynchronously
    await loadLinkedBattles(row.scheduled_match_id);
    await loadAvailableBattles(row.player_a_id?.player_id || row.player_a_id, row.player_b_id?.player_id || row.player_b_id, row.scheduled_from, row.scheduled_to, row.scheduled_match_id, row.stage);
    
    // Load existing result from scheduled_match_result if exists
    const { data: existingResult } = await supabase
      .from("scheduled_match_result")
      .select("final_score_a, final_score_b, points_a, points_b, decided_by")
      .eq("scheduled_match_id", row.scheduled_match_id)
      .maybeSingle();
    
    // Calculate suggested result if no result set yet
    if (row.score_a == null || row.score_b == null) {
      const suggested = await calculateSuggestedResult(row.scheduled_match_id, row.season_id, row.competition_id, row.stage);
      setManualResult({ 
        final_score_a: suggested?.scoreA ?? "", 
        final_score_b: suggested?.scoreB ?? "", 
        points_a: suggested?.pointsA ?? "",
        points_b: suggested?.pointsB ?? "",
        decided_by: "ADMIN" 
      });
    } else {
      // Use existing result data if available
      setManualResult({ 
        final_score_a: existingResult?.final_score_a ?? row.score_a ?? "", 
        final_score_b: existingResult?.final_score_b ?? row.score_b ?? "", 
        points_a: existingResult?.points_a ?? "",
        points_b: existingResult?.points_b ?? "",
        decided_by: existingResult?.decided_by ?? "ADMIN" 
      });
    }
    
    setOpen(true);
  }
  
  async function calculateSuggestedResult(scheduledMatchId, seasonId, competitionId, stage) {
    if (!seasonId || !competitionId || !stage) return null;
    
    // Get configuration for this competition/stage
    const { data: config, error: configError } = await supabase
      .from("season_competition_config")
      .select("api_battle_type, api_game_mode, best_of, points_schema")
      .eq("season_id", seasonId)
      .eq("competition_id", competitionId)
      .eq("stage", stage)
      .maybeSingle();
    
    if (configError || !config) {
      console.log("No config found for competition/stage");
      return null;
    }
    
    // Get linked battles for this match
    const { data: links } = await supabase
      .from("scheduled_match_battle_link")
      .select("battle_id")
      .eq("scheduled_match_id", scheduledMatchId);
    
    if (!links || links.length === 0) {
      console.log("No linked battles found");
      return null;
    }
    
    const battleIds = links.map(l => l.battle_id);
    
    // Get battle details
    const { data: battles } = await supabase
      .from("battle")
      .select("battle_id, api_battle_type, api_game_mode, round_count")
      .in("battle_id", battleIds);
    
    if (!battles) return null;
    
    // Filter battles that match the config
    const validBattles = battles.filter(b => 
      b.api_battle_type === config.api_battle_type && 
      b.api_game_mode === config.api_game_mode
    );
    
    if (validBattles.length === 0) {
      console.log("No battles match the configured type/mode");
      return null;
    }
    
    // Get battle rounds and players to calculate results
    const validBattleIds = validBattles.map(b => b.battle_id);
    const { data: battleRounds } = await supabase
      .from("battle_round")
      .select("battle_round_id, battle_id, round_no")
      .in("battle_id", validBattleIds);
    
    if (!battleRounds) return null;
    
    const battleRoundIds = battleRounds.map(r => r.battle_round_id);
    const { data: roundPlayers } = await supabase
      .from("battle_round_player")
      .select("battle_round_id, side, crowns, opponent_crowns")
      .in("battle_round_id", battleRoundIds);
    
    if (!roundPlayers) return null;
    
    // Calculate wins for each battle
    let playerAWins = 0;
    let playerBWins = 0;
    
    validBattles.forEach(battle => {
      const roundsForBattle = battleRounds.filter(r => r.battle_id === battle.battle_id);
      const roundNos = [...new Set(roundsForBattle.map(r => r.round_no))].sort((a,b) => a-b);
      
      let teamWins = 0;
      let oppWins = 0;
      
      roundNos.forEach(rn => {
        const roundIds = roundsForBattle.filter(r => r.round_no === rn).map(r => r.battle_round_id);
        const roundPlayerData = roundPlayers.filter(rp => roundIds.includes(rp.battle_round_id));
        
        const teamData = roundPlayerData.filter(rp => rp.side === "TEAM");
        const oppData = roundPlayerData.filter(rp => rp.side === "OPPONENT");
        
        const teamCrowns = teamData.reduce((sum, rp) => sum + (rp.crowns || 0), 0);
        const oppCrowns = teamData.reduce((sum, rp) => sum + (rp.opponent_crowns || 0), 0) +
                         oppData.reduce((sum, rp) => sum + (rp.crowns || 0), 0);
        
        if (teamCrowns > oppCrowns) teamWins++;
        else if (oppCrowns > teamCrowns) oppWins++;
      });
      
      // For Bo3/Bo5, count who won the battle
      if (teamWins > oppWins) playerAWins++;
      else if (oppWins > teamWins) playerBWins++;
    });
    
    console.log(`Suggested result: Player A ${playerAWins} - Player B ${playerBWins} (based on ${validBattles.length} battles)`);
    
    // Calculate points based on points_schema
    const pointsSchema = config.points_schema || {};
    const resultKey = `${playerAWins}-${playerBWins}`;
    const reverseKey = `${playerBWins}-${playerAWins}`;
    
    let pointsA = 0;
    let pointsB = 0;
    
    if (pointsSchema[resultKey] !== undefined) {
      pointsA = pointsSchema[resultKey];
      pointsB = pointsSchema[reverseKey] || 0;
    }
    
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
    
    // Get the linked battles
    const { data, error } = await supabase
      .from("scheduled_match_battle_link")
      .select("battle_id, linked_by_player, linked_by_admin")
      .eq("scheduled_match_id", scheduledMatchId);
    
    if (error) {
      console.error("Error loading linked battles:", error);
      setLinkedBattles([]);
      return;
    }
    
    if (!data || data.length === 0) {
      setLinkedBattles([]);
      return;
    }
    
    // Get battle details for linked battles
    const battleIds = data.map(d => d.battle_id);
    const { data: battles, error: e2 } = await supabase
      .from("battle")
      .select("battle_id, battle_time, api_game_mode, api_battle_type, round_count")
      .in("battle_id", battleIds)
      .order("battle_time", { ascending: false });
    
    if (e2) {
      console.error("Error loading battle details:", e2);
      setLinkedBattles(data || []);
      return;
    }
    
    // Get scheduled match details to know which players
    const { data: match } = await supabase
      .from("scheduled_match")
      .select("player_a_id, player_b_id")
      .eq("scheduled_match_id", scheduledMatchId)
      .single();
    
    if (!match) {
      setLinkedBattles(data || []);
      return;
    }
    
    const playerAId = match.player_a_id;
    const playerBId = match.player_b_id;
    
    // Get battle_round for these battles
    const { data: battleRounds } = await supabase
      .from("battle_round")
      .select("battle_round_id, battle_id, round_no")
      .in("battle_id", battleIds);
    
    // Get round player details (incluir opponent para CW_DAILY)
    const battleRoundIds = (battleRounds || []).map(r => r.battle_round_id);
    const { data: roundPlayers } = await supabase
      .from("battle_round_player")
      .select("battle_round_id, player_id, side, crowns, opponent_crowns, opponent")
      .in("battle_round_id", battleRoundIds);
    
    // Get player names (solo para jugadores registrados)
    const playerIds = [playerAId];
    if (playerBId) playerIds.push(playerBId);
    
    const { data: playerData } = await supabase
      .from("player")
      .select("player_id, name, nick")
      .in("player_id", playerIds);
    
    const playersById = {};
    (playerData || []).forEach(p => playersById[p.player_id] = p);
    
    // Enrich linked battles with battle details and results
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
      
      // Calculate result like in loadAvailableBattles
      const battleRoundsForThis = (battleRounds || []).filter(r => r.battle_id === battle.battle_id);
      const roundNos = [...new Set(battleRoundsForThis.map(r => r.round_no))].sort((a,b) => a-b);
      
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
      
      // Find which player is TEAM and which is OPPONENT
      const battleRoundIds = battleRoundsForThis.map(r => r.battle_round_id);
      const teamPlayer = (roundPlayers || []).find(rp => 
        battleRoundIds.includes(rp.battle_round_id) && 
        rp.side === "TEAM" && 
        (rp.player_id === playerAId || (playerBId && rp.player_id === playerBId))
      );
      
      // playerA should always be shown on the left
      let titleLeft, titleRight, scoreLeft, scoreRight;
      
      // Para CW_DAILY sin playerB, obtener nombre del opponent del JSON
      if (!playerBId) {
        const teamRoundPlayer = (roundPlayers || []).find(rp => 
          battleRoundIds.includes(rp.battle_round_id) && 
          rp.side === "TEAM"
        );
        
        const opponentData = teamRoundPlayer?.opponent;
        const opponentName = Array.isArray(opponentData) && opponentData.length > 0
          ? (opponentData[0].name || opponentData[0].tag || "Oponente")
          : "Oponente";
        
        titleLeft = playersById[playerAId]?.nick || playersById[playerAId]?.name || "Player A";
        titleRight = opponentName;
        
        if (teamPlayer?.player_id === playerAId) {
          scoreLeft = battle.round_count > 1 ? teamWins : teamTotalCrowns;
          scoreRight = battle.round_count > 1 ? oppWins : oppTotalCrowns;
        } else {
          scoreLeft = battle.round_count > 1 ? oppWins : oppTotalCrowns;
          scoreRight = battle.round_count > 1 ? teamWins : teamTotalCrowns;
        }
      } else {
        // Caso normal con dos jugadores registrados
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
      };
    });
    
    setLinkedBattles(enrichedData);
  }
  
  async function loadAvailableBattles(playerAId, playerBId, fromTime, toTime, scheduledMatchId = null, stage = null) {
    if (!playerAId) {
      setAvailableBattles([]);
      return;
    }
    
    setLoadingBattles(true);
    
    try {
      // Convert scheduled_from and scheduled_to to ISO if they're datetime-local strings
      const fromISO = fromInputValue(fromTime);
      const toISO = fromInputValue(toTime);
      
      // Get already linked battles to exclude them
      let alreadyLinked = [];
      const matchId = scheduledMatchId || form.scheduled_match_id;
      if (matchId) {
        const { data: linked } = await supabase
          .from("scheduled_match_battle_link")
          .select("battle_id")
          .eq("scheduled_match_id", matchId);
        alreadyLinked = (linked || []).map(l => l.battle_id);
      }
      
      // Get battle_round_player records
      let query = supabase
        .from("battle_round_player")
        .select("battle_round_id, player_id");
      
      // If playerBId is null (CW_DAILY), search only for playerA battles
      // Otherwise search for battles where both players participated
      if (playerBId) {
        query = query.or(`player_id.eq.${playerAId},player_id.eq.${playerBId}`);
      } else {
        query = query.eq("player_id", playerAId);
      }
      
      const { data: brp, error: e1 } = await query.limit(5000);
      if (e1) throw e1;
      
      // Group by battle_round_id
      const roundsByBattle = {};
      (brp || []).forEach(record => {
        if (!roundsByBattle[record.battle_round_id]) {
          roundsByBattle[record.battle_round_id] = new Set();
        }
        roundsByBattle[record.battle_round_id].add(record.player_id);
      });
      
      // Filter to valid rounds
      let validRoundIds;
      if (playerBId) {
        // For regular matches: both players must have participated
        validRoundIds = Object.entries(roundsByBattle)
          .filter(([_, playerSet]) => playerSet.has(playerAId) && playerSet.has(playerBId))
          .map(([roundId, _]) => roundId);
      } else {
        // For CW_DAILY: only playerA needs to have participated
        validRoundIds = Object.entries(roundsByBattle)
          .filter(([_, playerSet]) => playerSet.has(playerAId))
          .map(([roundId, _]) => roundId);
      }
      
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
      
      // Filter by game mode based on stage
      if (stage) {
        battleQuery = battleQuery.eq("api_game_mode", stage);
      }
      
      if (fromISO) battleQuery = battleQuery.gte("battle_time", fromISO);
      if (toISO) battleQuery = battleQuery.lte("battle_time", toISO);
      
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
      const playerIdsToFetch = playerBId ? [playerAId, playerBId] : [playerAId];
      const { data: playerData, error: e5 } = await supabase
        .from("player")
        .select("player_id, name, nick")
        .in("player_id", playerIdsToFetch);
      
      if (e5) throw e5;
      
      const playersById = {};
      (playerData || []).forEach(p => playersById[p.player_id] = p);
      
      // Combine data: for each battle, compute result
      const battlesWithResults = (battles || []).map(battle => {
        const battleRounds = (rounds || []).filter(r => r.battle_id === battle.battle_id);
        const roundNos = [...new Set(battleRounds.map(r => r.round_no))].sort((a,b) => a-b);
        
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
          (rp.player_id === playerAId || (playerBId && rp.player_id === playerBId))
        );
        const oppPlayer = (roundPlayers || []).find(rp => 
          battleRoundIds.includes(rp.battle_round_id) && 
          rp.side === "OPPONENT" && 
          (rp.player_id === playerAId || (playerBId && rp.player_id === playerBId))
        );
        
        // playerA should always be shown on the left
        let titleLeft, titleRight, scoreLeft, scoreRight;
        
        if (playerBId) {
          // Regular match with two players
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
        } else {
          // CW_DAILY: only playerA, show their result vs opponent
          titleLeft = playersById[playerAId]?.nick || playersById[playerAId]?.name || "Player A";
          titleRight = "Oponente";
          
          if (teamPlayer?.player_id === playerAId) {
            // playerA is TEAM
            scoreLeft = battle.round_count > 1 ? teamWins : teamTotalCrowns;
            scoreRight = battle.round_count > 1 ? oppWins : oppTotalCrowns;
          } else {
            // playerA is OPPONENT
            scoreLeft = battle.round_count > 1 ? oppWins : oppTotalCrowns;
            scoreRight = battle.round_count > 1 ? teamWins : teamTotalCrowns;
          }
        }
        
        return {
          ...battle,
          titleLeft,
          titleRight,
          scoreLeft,
          scoreRight,
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
    } catch (e) {
      console.error("Error loading available battles:", e);
      setAvailableBattles([]);
    } finally {
      setLoadingBattles(false);
    }
  }
  
  async function linkBattle(battleId) {
    if (!form.scheduled_match_id || !battleId) return;
    
    const { error } = await supabase
      .from("scheduled_match_battle_link")
      .insert({
        scheduled_match_id: form.scheduled_match_id,
        battle_id: battleId,
        linked_by_admin: user?.id || null,
        linked_by_player: null,
      });
    
    if (error) {
      alert("Error vinculando batalla: " + error.message);
      return;
    }
    
    // Reload linked battles using the full load function
    await loadLinkedBattles(form.scheduled_match_id);
    
    // Remove from available
    setAvailableBattles(prev => prev.filter(b => b.battle_id !== battleId));
  }
  
  async function unlinkBattle(battleId) {
    if (!form.scheduled_match_id || !battleId) return;
    
    const { error } = await supabase
      .from("scheduled_match_battle_link")
      .delete()
      .eq("scheduled_match_id", form.scheduled_match_id)
      .eq("battle_id", battleId);
    
    if (error) {
      alert("Error desvinculando batalla: " + error.message);
      return;
    }
    
    // Reload linked battles
    await loadLinkedBattles(form.scheduled_match_id);
    
    // Reload available battles to include this one again
    await loadAvailableBattles(form.player_a_id, form.player_b_id, form.scheduled_from, form.scheduled_to, form.scheduled_match_id, form.stage);
  }
  
  async function setManualResultForMatch() {
    if (!form.scheduled_match_id) return alert("Primero guardá el partido");
    
    const scoreA = parseInt(manualResult.final_score_a);
    const scoreB = parseInt(manualResult.final_score_b);
    const pointsA = manualResult.points_a !== "" ? parseInt(manualResult.points_a) : null;
    const pointsB = manualResult.points_b !== "" ? parseInt(manualResult.points_b) : null;
    
    if (isNaN(scoreA) || isNaN(scoreB)) {
      return alert("Ingresá puntajes válidos");
    }
    
    // Insert or update in scheduled_match_result
    const { error: resultError } = await supabase
      .from("scheduled_match_result")
      .upsert({
        scheduled_match_id: form.scheduled_match_id,
        final_score_a: scoreA,
        final_score_b: scoreB,
        points_a: pointsA,
        points_b: pointsB,
        decided_by: manualResult.decided_by,
        decided_at: new Date().toISOString(),
      }, {
        onConflict: "scheduled_match_id"
      });
    
    if (resultError) {
      alert("Error guardando resultado: " + resultError.message);
      return;
    }
    
    // Update scheduled_match score fields
    const { error: updateError } = await supabase
      .from("scheduled_match")
      .update({
        score_a: scoreA,
        score_b: scoreB,
        status: "OVERRIDDEN",
      })
      .eq("scheduled_match_id", form.scheduled_match_id);
    
    if (updateError) {
      alert("Error actualizando partido: " + updateError.message);
      return;
    }
    
    alert("Resultado guardado correctamente");
    
    // Update form
    setForm(prev => ({ ...prev, score_a: scoreA, score_b: scoreB, status: "OVERRIDDEN" }));
    
    // Reload list
    const rRes = await supabase
      .from("scheduled_match")
      .select(SCHEDULED_MATCH_SELECT)
      .eq("season_id", seasonId)
      .eq("zone_id", selectedZoneId)
      .order("created_at", { ascending: false });
    
    if (!rRes.error) {
      setRows(rRes.data || []);
    }
  }

  async function removeRow(id) {
    if (!confirm("¿Eliminar este partido?")) return;
    const dRes = await supabase.from("scheduled_match").delete().eq("scheduled_match_id", id);
    if (dRes.error) {
      console.error(dRes.error);
      alert(dRes.error.message);
      return;
    }
    setRows((prev) => prev.filter((x) => x.scheduled_match_id !== id));
  }

  async function save() {
    // basic validation
    if (!form.season_id || !form.zone_id) return alert("Falta temporada o zona.");
    if (!form.player_a_id || !form.player_b_id) return alert("Elegí Jugador A y Jugador B.");
    
    // Extract player IDs if they are objects
    const playerAId = form.player_a_id?.player_id || form.player_a_id;
    const playerBId = form.player_b_id?.player_id || form.player_b_id;
    
    if (playerAId === playerBId) return alert("Jugador A y B no pueden ser el mismo.");

    setSaving(true);

    const payload = {
      season_id: form.season_id,
      zone_id: form.zone_id,
      competition_id: form.competition_id || null,
      competition_stage_id: form.competition_stage_id || null,
      competition_group_id: form.competition_group_id || null,
      type: form.type || "CUP_MATCH",
      stage: form.stage || null,
      best_of: Number(form.best_of || 3),
      expected_team_size: Number(form.expected_team_size || 1),
      player_a_id: playerAId,
      player_b_id: playerBId,
      scheduled_from: fromInputValue(form.scheduled_from),
      scheduled_to: fromInputValue(form.scheduled_to),
      deadline_at: fromInputValue(form.deadline_at),
      status: form.status || "PENDING",
      // scores are optional at creation
    };

    let res;
    if (form.scheduled_match_id) {
      res = await supabase
        .from("scheduled_match")
        .update(payload)
        .eq("scheduled_match_id", form.scheduled_match_id)
        .select(SCHEDULED_MATCH_SELECT        )
        .maybeSingle();
    } else {
      res = await supabase
        .from("scheduled_match")
        .insert(payload)
        .select(SCHEDULED_MATCH_SELECT)
        .maybeSingle();
    }

    if (res.error) {
      console.error(res.error);
      alert(res.error.message);
      setSaving(false);
      return;
    }

    const saved = res.data;
    setRows((prev) => {
      const exists = prev.some((x) => x.scheduled_match_id === saved.scheduled_match_id);
      if (exists) return prev.map((x) => (x.scheduled_match_id === saved.scheduled_match_id ? saved : x));
      return [saved, ...prev];
    });

    setSaving(false);
    setOpen(false);
  }

  // cuando cambia competition => reset stage+group y cargar stages
  useEffect(() => {
    const competitionId = form?.competition_id; // o newMatch.competition_id, según tu state
    // reset dependientes
    setGroups([]);
    setForm((prev) => ({
      ...prev,
      competition_stage_id: null,
      competition_group_id: null,
    }));

    if (!competitionId) {
      setStages([]);
      return;
    }

    fetchStagesForCompetition(competitionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form?.competition_id]);

  // cuando cambia stage => reset group y cargar groups
  useEffect(() => {
    const stageId = form?.competition_stage_id;

    setForm((prev) => ({
      ...prev,
      competition_group_id: null,
    }));

    if (!stageId) {
      setGroups([]);
      return;
    }

    fetchGroupsForStage(stageId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form?.competition_stage_id]);
  
  // cuando cambia competition en BULK => reset stage y cargar bulkStages
  useEffect(() => {
    setBulkForm((p) => ({ ...p, competition_stage_id: null }));

    if (!bulkForm?.competition_id) {
      setBulkStages([]);
      return;
    }

    fetchStagesForCompetitionBulk(bulkForm.competition_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bulkForm?.competition_id]);

  // cuando cambia stage en BULK => reset group y cargar bulkGroups
  useEffect(() => {
    setBulkForm((p) => ({ ...p, competition_group_id: null }));

    if (!bulkForm?.competition_stage_id) {
      setBulkGroups([]);
      return;
    }

    fetchGroupsForStageBulk(bulkForm.competition_stage_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bulkForm?.competition_stage_id]);

  // cuando cambia stage en BULK => reset group y cargar bulkGroups
  useEffect(() => {
    setBulkForm((p) => ({ ...p, competition_group_id: null }));

    if (!bulkForm?.competition_stage_id) {
      setBulkGroups([]);
      return;
    }

    fetchGroupsForStageBulk(bulkForm.competition_stage_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bulkForm?.competition_stage_id]);

  function openBulkCreate() {
    setBulkForm({
      ...bulkEmpty,
      season_id: seasonId || "",
      zone_id: selectedZoneId || "",
      best_of: 3,
      items: [{ player_a_id: "", player_b_id: "" }],
    });
    setBulkStages([]);
    setBulkOpen(true);
  }

  function addBulkRow() {
    setBulkForm((p) => ({
      ...p,
      items: [...(p.items || []), { player_a_id: "", player_b_id: "" }],
    }));
  }

  function removeBulkRow(idx) {
    setBulkForm((p) => {
      const next = [...(p.items || [])];
      next.splice(idx, 1);
      return { ...p, items: next.length ? next : [{ player_a_id: "", player_b_id: "" }] };
    });
  }

  function updateBulkRow(idx, patch) {
    setBulkForm((p) => {
      const next = [...(p.items || [])];
      next[idx] = { ...next[idx], ...patch };
      return { ...p, items: next };
    });
  }

  async function saveBulk() {
    // Validación base
    if (!bulkForm.season_id || !bulkForm.zone_id) return alert("Falta temporada o zona.");
    if (!bulkForm.competition_id) return alert("Elegí una copa (competition).");
    if (!bulkForm.competition_stage_id) return alert("Elegí un stage (competition_stage).");

    const cleanItems = (bulkForm.items || [])
      .map((x) => ({
        player_a_id: x.player_a_id || "",
        player_b_id: x.player_b_id || "",
      }))
      .filter((x) => x.player_a_id && x.player_b_id);

    if (!cleanItems.length) return alert("Agregá al menos 1 batalla (Jugador A y Jugador B).");

    // Validaciones por fila: A != B y evitar duplicados exactos
    for (let i = 0; i < cleanItems.length; i++) {
      const it = cleanItems[i];
      if (it.player_a_id === it.player_b_id) {
        return alert(`Fila ${i + 1}: Jugador A y B no pueden ser el mismo.`);
      }
    }

    const seen = new Set();
    for (let i = 0; i < cleanItems.length; i++) {
      const it = cleanItems[i];
      const key = `${it.player_a_id}__${it.player_b_id}`;
      if (seen.has(key)) return alert(`Fila ${i + 1}: Batalla duplicada (A vs B repetida).`);
      seen.add(key);
    }

    setBulkSaving(true);

    const common = {
      season_id: bulkForm.season_id,
      zone_id: bulkForm.zone_id,
      competition_id: bulkForm.competition_id || null,
      competition_stage_id: bulkForm.competition_stage_id || null,
      competition_group_id: bulkForm.competition_group_id || null,
      type: "CUP_MATCH",
      stage: "CUP_QUALY",
      best_of: Number(bulkForm.best_of || 3),
      expected_team_size: 1,
      scheduled_from: fromInputValue(bulkForm.scheduled_from),
      scheduled_to: fromInputValue(bulkForm.scheduled_to),
      deadline_at: fromInputValue(bulkForm.deadline_at),
      status: "PENDING",
    };

    const payloads = cleanItems.map((it) => ({
      ...common,
      player_a_id: it.player_a_id,
      player_b_id: it.player_b_id,
    }));

    const res = await supabase
      .from("scheduled_match")
      .insert(payloads)
      .select(SCHEDULED_MATCH_SELECT);

    if (res.error) {
      console.error(res.error);
      alert(res.error.message);
      setBulkSaving(false);
      return;
    }

    const inserted = res.data || [];
    // agrego arriba (mantenemos tu orden created_at desc)
    setRows((prev) => [...inserted, ...prev]);

    setBulkSaving(false);
    setBulkOpen(false);
  }

  const pageTitle = "Partidos de Copa";
  const subtitle = "Crear y administrar enfrentamientos manuales (scheduled_match)";

  return (
    <div className="min-h-screen bg-[#070b12] text-white">
      {/* Top bar */}
      <div className="px-5 pt-6 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => nav(-1)}
            className="h-10 w-10 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition"
            aria-label="Volver"
          >
            ←
          </button>
          <div className="flex-1">
            <div className="text-xl font-semibold">{pageTitle}</div>
            <div className="text-sm text-white/60">{subtitle}</div>
          </div>
          <button
            onClick={openCreate}
            className="rounded-xl px-4 py-2 bg-white/10 hover:bg-white/15 border border-white/10 transition font-semibold"
          >
            + Nuevo Partido
          </button>

          <button
              onClick={openBulkCreate}
              className="rounded-xl px-4 py-2 bg-emerald-500/15 hover:bg-emerald-500/20 border border-emerald-500/30 transition font-semibold text-emerald-100"
            >
              + Bulk
            </button>          
        </div>
      </div>

      {/* Filters */}
      <div className="px-5">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">

            <div className="lg:col-span-3">
              <div className="text-sm text-white/70 mb-2">Zona</div>
              <select
                value={selectedZoneId}
                onChange={(e) => setSelectedZoneId(e.target.value)}
                className="w-full rounded-xl bg-[#0b1220] border border-white/10 px-3 py-2.5 outline-none focus:border-white/20"
              >
                {zones.map((z) => (
                  <option key={z.zone_id} value={z.zone_id} className="bg-[#0b1220]">
                    {z.name} (Orden {z.zone_order})
                  </option>
                ))}
              </select>
            </div>

            <div className="lg:col-span-2">
              <div className="text-sm text-white/70 mb-2">Estado</div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full rounded-xl bg-[#0b1220] border border-white/10 px-3 py-2.5 outline-none focus:border-white/20"
              >
                <option value="ALL">Todos</option>
                <option value="PENDING">PENDING</option>
                <option value="OVERRIDDEN">OVERRIDDEN</option>
                <option value="COMPLETED">COMPLETED</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            </div>

            <div className="lg:col-span-2">
              <div className="text-sm text-white/70 mb-2">Desde</div>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full rounded-xl bg-[#0b1220] border border-white/10 px-3 py-2.5 outline-none focus:border-white/20 text-white"
              />
            </div>

            <div className="lg:col-span-2">
              <div className="text-sm text-white/70 mb-2">Hasta</div>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full rounded-xl bg-[#0b1220] border border-white/10 px-3 py-2.5 outline-none focus:border-white/20 text-white"
              />
            </div>

            <div className="lg:col-span-3">
              <div className="text-sm text-white/70 mb-2">Buscar</div>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Jugador / copa / stage / grupo..."
                className="w-full rounded-xl bg-[#0b1220] border border-white/10 px-3 py-2.5 outline-none focus:border-white/20"
              />
            </div>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="px-5 pb-10 mt-6">
        <div className="flex items-center justify-between mb-3">
          <div className="text-lg font-semibold">Lista de Partidos</div>
          <div className="text-sm text-white/60">{filteredRows.length} partidos</div>
        </div>

        <div className="space-y-4">
          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/70">
              Cargando...
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/70">
              No hay partidos para esta temporada/zona.
            </div>
          ) : (
            filteredRows.map((r) => (
              <div
                key={r.scheduled_match_id}
                className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/5 to-white/3 p-4"
              >
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs px-2 py-1 rounded-lg bg-blue-500/20 border border-blue-500/30 text-blue-200">
                        {r.type}
                      </span>
                      {r.stage ? (
                        <span className="text-xs px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-white/80">
                          {r.stage}
                        </span>
                      ) : null}
                      {r.competition?.name ? (
                        <span className="text-xs px-2 py-1 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-200">
                          {r.competition.name}
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-white/60">
                          (sin copa)
                        </span>
                      )}
                      {r.competition_group?.name && (
                        <span className="text-xs px-2 py-1 rounded-lg bg-purple-500/20 border border-purple-500/30 text-purple-200">
                          {r.competition_group.name} {r.competition_group.code ? `(${r.competition_group.code})` : ""}
                        </span>
                      )}
                      <span className="text-xs px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-white/70">
                        Bo{r.best_of}
                      </span>
                      <span className="text-xs px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-white/70">
                        {r.status}
                      </span>
                    </div>

                    <div className="mt-3 text-base font-semibold">
                      {(r.player_a_id?.nick || r.player_a_id?.name || "Jugador A")}{" "}
                      <span className="text-white/40">vs</span>{" "}
                      {r.player_b_id 
                        ? (r.player_b_id.nick || r.player_b_id.name || "Jugador B")
                        : (r.opponent_name || <span className="text-white/60 italic">(Oponente en batalla)</span>)
                      }
                      
                      {(r.score_a != null && r.score_b != null) ? (
                        <span className="ml-3 text-white/80">
                          — <span className="text-emerald-300">{r.score_a}</span>
                          <span className="text-white/40"> - </span>
                          <span className="text-rose-300">{r.score_b}</span>
                        </span>
                      ) : null} 
                    </div>

                    <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-white/70">
                      <div className="rounded-xl bg-[#0b1220] border border-white/10 px-3 py-2">
                        <div className="text-xs text-white/50">Deadline</div>
                        <div>{formatDeadline(r.deadline_at, nowTs)}</div>
                      </div>
                      <div className="rounded-xl bg-[#0b1220] border border-white/10 px-3 py-2">
                        <div className="text-xs text-white/50">Ventana</div>
                        <div>
                          {formatDateOnly(r.scheduled_from)} <span className="text-white/40">→</span> {formatDateOnly(r.scheduled_to)}
                        </div>
                      </div>
                      <div className="rounded-xl bg-[#0b1220] border border-white/10 px-3 py-2">
                        <div className="text-xs text-white/50">ID</div>
                        <div className="truncate">{r.scheduled_match_id}</div>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => openEdit(r)}
                      className="h-9 px-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 transition flex items-center justify-center text-sm font-medium"
                      title="Editar"
                    >
                      ✏️ Editar
                    </button>
                    {r.type === "CW_DAILY" && r.linked_battles && r.linked_battles.length > 0 && (
                      <button
                        onClick={() => {
                          setSelectedBattleId(r.linked_battles[0].battle_id);
                          setBattleModalOpen(true);
                        }}
                        className="h-9 px-3 rounded-xl bg-blue-500/15 hover:bg-blue-500/20 border border-blue-500/30 transition flex items-center justify-center text-sm font-medium text-blue-200"
                        title="Ver batalla"
                      >
                        👁️ Ver
                      </button>
                    )}
                    <button
                      onClick={() => removeRow(r.scheduled_match_id)}
                      className="h-9 px-3 rounded-xl bg-rose-500/15 hover:bg-rose-500/20 border border-rose-500/30 transition flex items-center justify-center text-sm font-medium text-rose-200"
                      title="Eliminar"
                    >
                      🗑️ Eliminar
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal */}
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 overflow-y-auto">
          <div className="w-full max-w-3xl rounded-2xl border border-white/10 bg-[#0a0f1b] overflow-hidden my-8">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold">
                  {form.scheduled_match_id 
                    ? `Editar Partido - ${editPlayerNames.playerA} vs ${editPlayerNames.playerB}` 
                    : "Nuevo Partido"}
                </div>
                <div className="text-sm text-white/60">scheduled_match</div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="h-10 w-10 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition"
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>

            <div className="p-4 max-h-[calc(100vh-200px)] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Competition */}
                <div>
                  <div className="text-sm text-white/70 mb-2">Copa (competition)</div>
                  <select
                    className="select-arrow w-full appearance-none rounded-lg border border-slate-300/20 bg-white/5 px-3 py-2.5 text-sm text-white outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
                    value={form.competition_id ?? ""}
                    onChange={(e) => setForm((p) => ({ ...p, competition_id: e.target.value || null }))}
                  >
                    <option value="" className="bg-[#0b1220]">— Sin competencia —</option>
                    {competitions.map((c) => (
                      <option key={c.competition_id} value={c.competition_id} className="bg-[#0b1220]">
                        {c.name} {c.code ? `(${c.code})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Optional stage_id */}
                <div>
                  <div className="text-sm text-white/70 mb-2">competition_stage_id</div>
                  <select
                    disabled={!form.competition_id || loadingStages || stages.length === 0}
                    className="select-arrow w-full appearance-none rounded-lg border border-slate-300/20 bg-white/5 px-3 py-2.5 text-sm text-white outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50"
                    value={form.competition_stage_id ?? ""}
                    onChange={(e) => setForm((p) => ({ ...p, competition_stage_id: e.target.value || null }))}
                  >
                    <option value="" className="bg-[#0b1220]">
                      {loadingStages  ? "Cargando..." : "— Seleccionar stage —"}
                    </option>

                    {stages.map((s) => (
                      <option key={s.competition_stage_id} value={s.competition_stage_id} className="bg-[#0b1220]">
                        {s.stage}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Optional group_id */}
                <div>
                  <div className="text-sm text-white/70 mb-2">competition_group_id</div>
                  <select
                    disabled={!form.competition_stage_id || loadingGroups || groups.length === 0}
                    className="select-arrow w-full appearance-none rounded-lg border border-slate-300/20 bg-white/5 px-3 py-2.5 text-sm text-white outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50"
                    value={form.competition_group_id ?? ""}
                    onChange={(e) => setForm((p) => ({ ...p, competition_group_id: e.target.value || null }))}
                  >
                    <option value="" className="bg-[#0b1220]">
                      {loadingGroups ? "Cargando..." : "— Seleccionar grupo —"}
                    </option>

                    {groups.map((g) => (
                      <option key={g.competition_group_id} value={g.competition_group_id} className="bg-[#0b1220]">
                        {g.name} {g.code ? `(${g.code})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Player A - Only show when creating new */}
                {!form.scheduled_match_id && (
                  <div>
                    <div className="text-sm text-white/70 mb-2">Jugador A</div>
                    <select
                      value={form.player_a_id}
                      onChange={(e) => setForm((f) => ({ ...f, player_a_id: e.target.value }))}
                      className="w-full rounded-xl bg-[#0b1220] border border-white/10 px-3 py-2.5 outline-none focus:border-white/20"
                    >
                      <option value="" className="bg-[#0b1220]">
                        Seleccionar...
                      </option>
                      {players.map((p) => (
                        <option key={p.player_id} value={p.player_id} className="bg-[#0b1220]">
                          {p.nick || p.name || p.player_id}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Player B - Only show when creating new */}
                {!form.scheduled_match_id && (
                  <div>
                    <div className="text-sm text-white/70 mb-2">Jugador B</div>
                    <select
                      value={form.player_b_id}
                      onChange={(e) => setForm((f) => ({ ...f, player_b_id: e.target.value }))}
                      className="w-full rounded-xl bg-[#0b1220] border border-white/10 px-3 py-2.5 outline-none focus:border-white/20"
                    >
                      <option value="" className="bg-[#0b1220]">
                        Seleccionar...
                      </option>
                      {players.map((p) => (
                        <option key={p.player_id} value={p.player_id} className="bg-[#0b1220]">
                          {p.nick || p.name || p.player_id}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* best_of */}
                <div>
                  <div className="text-sm text-white/70 mb-2">Best of</div>
                  <select
                    value={form.best_of}
                    onChange={(e) => setForm((f) => ({ ...f, best_of: Number(e.target.value) }))}
                    className="w-full rounded-xl bg-[#0b1220] border border-white/10 px-3 py-2.5 outline-none focus:border-white/20"
                  >
                    <option value={3} className="bg-[#0b1220]">
                      Bo3
                    </option>
                    <option value={5} className="bg-[#0b1220]">
                      Bo5
                    </option>
                  </select>
                </div>

                {/* status */}
                <div>
                  <div className="text-sm text-white/70 mb-2">Status</div>
                  <select
                    value={form.status}
                    onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                    className="w-full rounded-xl bg-[#0b1220] border border-white/10 px-3 py-2.5 outline-none focus:border-white/20"
                  >
                    {["PENDING", "LINKED", "CONFIRMED", "OVERRIDDEN"].map((x) => (
                      <option key={x} value={x} className="bg-[#0b1220]">
                        {x}
                      </option>
                    ))}
                  </select>
                </div>

                {/* dates */}
                <div>
                  <div className="text-sm text-white/70 mb-2">Desde (scheduled_from)</div>
                  <input
                    type="datetime-local"
                    value={form.scheduled_from}
                    onChange={(e) => setForm((f) => ({ ...f, scheduled_from: e.target.value }))}
                    className="w-full rounded-xl bg-[#0b1220] border border-white/10 px-3 py-2.5 outline-none focus:border-white/20"
                  />
                </div>

                <div>
                  <div className="text-sm text-white/70 mb-2">Hasta (scheduled_to)</div>
                  <input
                    type="datetime-local"
                    value={form.scheduled_to}
                    onChange={(e) => setForm((f) => ({ ...f, scheduled_to: e.target.value }))}
                    className="w-full rounded-xl bg-[#0b1220] border border-white/10 px-3 py-2.5 outline-none focus:border-white/20"
                  />
                </div>

                <div className="md:col-span-2">
                  <div className="text-sm text-white/70 mb-2">Deadline</div>
                  <input
                    type="datetime-local"
                    value={form.deadline_at}
                    onChange={(e) => setForm((f) => ({ ...f, deadline_at: e.target.value }))}
                    className="w-full rounded-xl bg-[#0b1220] border border-white/10 px-3 py-2.5 outline-none focus:border-white/20"
                  />
                </div>
              </div>
              
              {/* Battle Linking Section - Only show when editing existing match */}
              {form.scheduled_match_id && (
                <div className="mt-6 space-y-4">
                  <div className="border-t border-white/10 pt-4">
                    <div className="text-lg font-semibold mb-3">Batallas Vinculadas</div>
                    
                    {linkedBattles.length === 0 ? (
                      <div className="text-sm text-white/60 mb-3">No hay batallas vinculadas</div>
                    ) : (
                      <div className="space-y-2 mb-3">
                        {linkedBattles.map((link) => {
                          const winnerLeft = link.scoreLeft > link.scoreRight;
                          const winnerRight = link.scoreRight > link.scoreLeft;
                          
                          return (
                            <div key={link.battle_id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                              <div className="flex flex-col gap-2 mb-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <div className="rounded-lg bg-slate-900/60 px-2 py-1">
                                    <div className="text-[10px] text-white/50">Fecha</div>
                                    <div className="text-xs">{link.battle_time ? formatDateOnly(link.battle_time) : "—"}</div>
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
                                    <div className="text-sm">
                                      <span className={winnerLeft ? "text-emerald-400 font-semibold" : "text-white/80"}>
                                        {link.titleLeft}
                                      </span>
                                      {" vs "}
                                      <span className={winnerRight ? "text-emerald-400 font-semibold" : "text-white/80"}>
                                        {link.titleRight}
                                      </span>
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
                                    <div className="text-xs">{formatDateOnly(battle.battle_time)}</div>
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
                                  <div className="text-sm">
                                    <span className={winnerLeft ? "text-emerald-400 font-semibold" : "text-white/80"}>
                                      {battle.titleLeft}
                                    </span>
                                    <span className="mx-2 text-white/40">vs</span>
                                    <span className={winnerRight ? "text-emerald-400 font-semibold" : "text-white/80"}>
                                      {battle.titleRight}
                                    </span>
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
                                  onClick={() => linkBattle(battle.battle_id)}
                                  className="rounded-lg px-3 py-1 bg-emerald-500/15 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-100 text-xs font-semibold transition"
                                >
                                  Vincular
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  
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
                    
                    <div className="mb-3">
                      <div className="text-sm text-white/70 mb-2">Decidido por</div>
                      <select
                        value={manualResult.decided_by}
                        onChange={(e) => setManualResult(prev => ({ ...prev, decided_by: e.target.value }))}
                        className="w-full rounded-xl bg-[#0b1220] border border-white/10 px-3 py-2.5 outline-none focus:border-white/20"
                      >
                        <option value="ADMIN">Admin</option>
                        <option value="SYSTEM">Sistema</option>
                        <option value="PLAYER">Jugador</option>
                      </select>
                    </div>
                    
                    <button
                      onClick={setManualResultForMatch}
                      className="w-full rounded-xl px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 transition font-semibold text-blue-100"
                    >
                      Guardar Resultado
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-white/10 flex items-center justify-end gap-2">
              <button
                onClick={() => setOpen(false)}
                className="rounded-xl px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 transition font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={save}
                disabled={saving}
                className={cls(
                  "rounded-xl px-5 py-2 bg-blue-600/80 hover:bg-blue-600 border border-blue-500/30 transition font-semibold",
                  saving && "opacity-60"
                )}
              >
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

       {/* Bulk Modal */}
      {bulkOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="w-full max-w-4xl rounded-2xl border border-white/10 bg-[#0a0f1b] overflow-hidden">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold">Bulk: Crear Partidos</div>
                <div className="text-sm text-white/60">
                  Seleccioná parámetros comunes y agregá varias batallas (sin grupo).
                </div>
              </div>
              <button
                onClick={() => setBulkOpen(false)}
                className="h-10 w-10 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition"
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-5">
              {/* Campos comunes */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Competition */}
                <div>
                  <div className="text-sm text-white/70 mb-2">Copa (competition)</div>
                  <select
                    className="select-arrow w-full appearance-none rounded-lg border border-slate-300/20 bg-white/5 px-3 py-2.5 text-sm text-white outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
                    value={bulkForm.competition_id ?? ""}
                    onChange={(e) =>
                      setBulkForm((p) => ({ ...p, competition_id: e.target.value || null }))
                    }
                  >
                    <option value="" className="bg-[#0b1220]">
                      — Seleccionar copa —
                    </option>
                    {competitions.map((c) => (
                      <option key={c.competition_id} value={c.competition_id} className="bg-[#0b1220]">
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Stage */}
                <div>
                  <div className="text-sm text-white/70 mb-2">Stage</div>
                  <select
                    disabled={!bulkForm.competition_id || bulkLoadingStages || bulkStages.length === 0}
                    className="select-arrow w-full appearance-none rounded-lg border border-slate-300/20 bg-white/5 px-3 py-2.5 text-sm text-white outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50"
                    value={bulkForm.competition_stage_id ?? ""}
                    onChange={(e) =>
                      setBulkForm((p) => ({ ...p, competition_stage_id: e.target.value || null }))
                    }
                  >
                    <option value="" className="bg-[#0b1220]">
                      {bulkLoadingStages ? "Cargando..." : "— Seleccionar stage —"}
                    </option>
                    {bulkStages.map((s) => (
                      <option key={s.competition_stage_id} value={s.competition_stage_id} className="bg-[#0b1220]">
                        {s.stage}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Group (only if stage is selected) */}
                {bulkForm.competition_stage_id && (
                  <div>
                    <div className="text-sm text-white/70 mb-2">Grupo</div>
                    <select
                      disabled={!bulkForm.competition_stage_id || bulkLoadingGroups || bulkGroups.length === 0}
                      className="select-arrow w-full appearance-none rounded-lg border border-slate-300/20 bg-white/5 px-3 py-2.5 text-sm text-white outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50"
                      value={bulkForm.competition_group_id ?? ""}
                      onChange={(e) =>
                        setBulkForm((p) => ({ ...p, competition_group_id: e.target.value || null }))
                      }
                    >
                      <option value="" className="bg-[#0b1220]">
                        {bulkLoadingGroups ? "Cargando..." : "— Seleccionar grupo —"}
                      </option>
                      {bulkGroups.map((g) => (
                        <option key={g.competition_group_id} value={g.competition_group_id} className="bg-[#0b1220]">
                          {g.name} {g.code ? `(${g.code})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Best of */}
                <div>
                  <div className="text-sm text-white/70 mb-2">Best of</div>
                  <select
                    value={bulkForm.best_of}
                    onChange={(e) => setBulkForm((p) => ({ ...p, best_of: Number(e.target.value) }))}
                    className="w-full rounded-xl bg-[#0b1220] border border-white/10 px-3 py-2.5 outline-none focus:border-white/20"
                  >
                    <option value={3} className="bg-[#0b1220]">Bo3</option>
                    <option value={5} className="bg-[#0b1220]">Bo5</option>
                  </select>
                </div>

                {/* Desde */}
                <div>
                  <div className="text-sm text-white/70 mb-2">Desde (scheduled_from)</div>
                  <input
                    type="datetime-local"
                    value={bulkForm.scheduled_from}
                    onChange={(e) => setBulkForm((p) => ({ ...p, scheduled_from: e.target.value }))}
                    className="w-full rounded-xl bg-[#0b1220] border border-white/10 px-3 py-2.5 outline-none focus:border-white/20"
                  />
                </div>

                {/* Hasta */}
                <div>
                  <div className="text-sm text-white/70 mb-2">Hasta (scheduled_to)</div>
                  <input
                    type="datetime-local"
                    value={bulkForm.scheduled_to}
                    onChange={(e) => setBulkForm((p) => ({ ...p, scheduled_to: e.target.value }))}
                    className="w-full rounded-xl bg-[#0b1220] border border-white/10 px-3 py-2.5 outline-none focus:border-white/20"
                  />
                </div>

                {/* Deadline */}
                <div>
                  <div className="text-sm text-white/70 mb-2">Deadline</div>
                  <input
                    type="datetime-local"
                    value={bulkForm.deadline_at}
                    onChange={(e) => setBulkForm((p) => ({ ...p, deadline_at: e.target.value }))}
                    className="w-full rounded-xl bg-[#0b1220] border border-white/10 px-3 py-2.5 outline-none focus:border-white/20"
                  />
                </div>
              </div>

              {/* Lista de batallas */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-semibold">Batallas a crear</div>
                  <button
                    onClick={addBulkRow}
                    className="rounded-xl px-3 py-2 bg-white/10 hover:bg-white/15 border border-white/10 transition font-semibold text-sm"
                  >
                    + Agregar fila
                  </button>
                </div>

                <div className="space-y-3">
                  {(bulkForm.items || []).map((it, idx) => (
                    <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                      <div className="md:col-span-5">
                        <div className="text-xs text-white/60 mb-1">Jugador A</div>
                        <select
                          value={it.player_a_id}
                          onChange={(e) => updateBulkRow(idx, { player_a_id: e.target.value })}
                          className="w-full rounded-xl bg-[#0b1220] border border-white/10 px-3 py-2.5 outline-none focus:border-white/20"
                        >
                          <option value="" className="bg-[#0b1220]">Seleccionar...</option>
                          {players.map((p) => (
                            <option key={p.player_id} value={p.player_id} className="bg-[#0b1220]">
                              {p.nick || p.name || p.player_id}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="md:col-span-5">
                        <div className="text-xs text-white/60 mb-1">Jugador B</div>
                        <select
                          value={it.player_b_id}
                          onChange={(e) => updateBulkRow(idx, { player_b_id: e.target.value })}
                          className="w-full rounded-xl bg-[#0b1220] border border-white/10 px-3 py-2.5 outline-none focus:border-white/20"
                        >
                          <option value="" className="bg-[#0b1220]">Seleccionar...</option>
                          {players.map((p) => (
                            <option key={p.player_id} value={p.player_id} className="bg-[#0b1220]">
                              {p.nick || p.name || p.player_id}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="md:col-span-2 flex justify-end">
                        <button
                          onClick={() => removeBulkRow(idx)}
                          className="rounded-xl px-3 py-2 bg-rose-500/15 hover:bg-rose-500/20 border border-rose-500/30 transition font-semibold text-rose-100 text-sm"
                        >
                          Quitar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-3 text-xs text-white/50">
                  Tip: podés dejar filas vacías (no se insertan). Se valida que A != B y que no se repita A vs B.
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-white/10 flex items-center justify-end gap-2">
              <button
                onClick={() => setBulkOpen(false)}
                className="rounded-xl px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 transition font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={saveBulk}
                disabled={bulkSaving}
                className={cls(
                  "rounded-xl px-5 py-2 bg-emerald-600/80 hover:bg-emerald-600 border border-emerald-500/30 transition font-semibold",
                  bulkSaving && "opacity-60"
                )}
              >
                {bulkSaving ? "Guardando..." : "Crear en bulk"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Battle Detail Modal */}
      {battleModalOpen && selectedBattleId && (
        <BattleDetailModal
          battleId={selectedBattleId}
          onClose={() => {
            setBattleModalOpen(false);
            setSelectedBattleId(null);
          }}
        />
      )}
    </div>
  );
}
