import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { getBattleDateKey, selectBestBattle } from "../../lib/battleDateUtils";

function fmtDateShort(dateStr) {
  if (!dateStr) return "";
  // dateStr: YYYY-MM-DD
  const [y, m, d] = dateStr.split("-").map((x) => parseInt(x, 10));
  if (!y || !m || !d) return dateStr;
  const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  return `${d} ${months[m - 1]}`;
}

function fmtDateRange(season) {
  // Prefer explicit season_start_at/end_at if available, else duel/ladder dates
  const start =
    season?.season_start_at
      ? new Date(season.season_start_at).toLocaleDateString("es-AR", { day: "2-digit", month: "short" })
      : (season?.duel_start_date ? fmtDateShort(season.duel_start_date) : "");

  const end =
    season?.season_end_at
      ? new Date(season.season_end_at).toLocaleDateString("es-AR", { day: "2-digit", month: "short" })
      : (season?.duel_end_date ? fmtDateShort(season.duel_end_date) : (season?.ladder_start_date ? fmtDateShort(season.ladder_start_date) : ""));

  if (start && end) return `${start} - ${end}`;
  return start || end || "";
}

function statusBadge(status) {
  const s = (status || "DRAFT").toUpperCase();
  if (s === "ACTIVE") {
    return (
      <span className="inline-flex items-center rounded-md bg-green-500/10 px-2 py-1 text-xs font-medium text-green-700 dark:text-green-400 ring-1 ring-inset ring-green-600/20">
        Activa
      </span>
    );
  }
  if (s === "CLOSED") {
    return (
      <span className="text-xs font-medium text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-gray-700 px-1.5 py-0.5 rounded">
        Finalizada
      </span>
    );
  }
  return (
    <span className="text-xs font-medium text-blue-700 dark:text-blue-300 border border-blue-200/70 dark:border-blue-900 px-1.5 py-0.5 rounded">
      Draft
    </span>
  );
}

export default function SeasonsList() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [seasons, setSeasons] = useState([]);
  const [generatingDuels, setGeneratingDuels] = useState(false);
  const [autoLinking, setAutoLinking] = useState(false);
  const [progressInfo, setProgressInfo] = useState({ current: 0, total: 0, zone: '', player: '', created: 0, skipped: 0, canceled: 0 });

  async function load() {
    setLoading(true);

    // Join era description
    const { data, error } = await supabase
      .from("season")
      .select("season_id, era_id, description, status, duel_start_date, duel_end_date, ladder_start_date, season_start_at, season_end_at, created_at, era:era_id(description)")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setSeasons([]);
      setLoading(false);
      return;
    }

    setSeasons(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const activeSeason = useMemo(() => {
    const actives = seasons.filter((s) => (s.status || "").toUpperCase() === "ACTIVE");
    if (actives.length === 0) return null;

    // choose most recent by season_start_at if present else created_at
    const sorted = [...actives].sort((a, b) => {
      const aa = a.season_start_at ? new Date(a.season_start_at).getTime() : new Date(a.created_at).getTime();
      const bb = b.season_start_at ? new Date(b.season_start_at).getTime() : new Date(b.created_at).getTime();
      return bb - aa;
    });
    return sorted[0];
  }, [seasons]);

  const history = useMemo(() => {
    if (!activeSeason) return seasons;
    return seasons.filter((s) => s.season_id !== activeSeason.season_id);
  }, [seasons, activeSeason]);

  async function onDelete(season) {
    if (!confirm(`Eliminar temporada "${season.description}"?`)) return;

    const { error } = await supabase.from("season").delete().eq("season_id", season.season_id);
    if (error) {
      alert(`No se pudo eliminar: ${error.message}`);
      return;
    }
    await load();
  }

  async function generateDailyDuels(seasonId) {
    if (!confirm("¿Reconciliar duelos diarios (CW_Duel_1v1) para todos los jugadores de esta temporada?\n\nSe crearán las batallas pendientes faltantes y se cancelarán las pendientes fuera del rango válido.")) {
      return;
    }

    setGeneratingDuels(true);

    try {
      const dateKey = (date) => {
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, "0");
        const dd = String(date.getDate()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}`;
      };

      // 1. Obtener las fechas de duelo de la temporada
      const { data: seasonData, error: seasonError } = await supabase
        .from("season")
        .select("duel_start_date, duel_end_date")
        .eq("season_id", seasonId)
        .single();

      if (seasonError) throw seasonError;

      if (!seasonData?.duel_start_date || !seasonData?.duel_end_date) {
        alert("La temporada debe tener Duel Start Date y Duel End Date configuradas");
        setGeneratingDuels(false);
        return;
      }

      const seasonStart = new Date(`${seasonData.duel_start_date}T00:00:00`);
      const seasonEnd = new Date(`${seasonData.duel_end_date}T23:59:59`);

      if (seasonStart > seasonEnd) {
        alert("Duel End Date no puede ser anterior a Duel Start Date");
        setGeneratingDuels(false);
        return;
      }

      // 2. Obtener todas las zonas de la temporada
      const { data: zones, error: zonesError } = await supabase
        .from("season_zone")
        .select("zone_id, name")
        .eq("season_id", seasonId);

      if (zonesError) throw zonesError;

      if (!zones || zones.length === 0) {
        alert("No hay zonas configuradas en esta temporada");
        setGeneratingDuels(false);
        return;
      }

      let totalCreated = 0;
      let totalSkipped = 0;
      let totalCanceled = 0;
      let totalPlayers = 0;
      let processedPlayers = 0;
      const zoneAssignments = [];

      // 3. Obtener asignaciones por zona
      for (const zone of zones) {
        const { data: assignments, error: assignError } = await supabase
          .from("season_zone_team_player")
          .select("player_id, start_date, end_date, player:player(player_id, name, nick)")
          .eq("zone_id", zone.zone_id)
          .not("start_date", "is", null);

        if (assignError) {
          console.error(`Error getting assignments for zone ${zone.name}:`, assignError);
          continue;
        }

        const safeAssignments = assignments || [];
        totalPlayers += safeAssignments.length;
        zoneAssignments.push({ zone, assignments: safeAssignments });
      }

      // 4. Para cada jugador, crear faltantes y cancelar pendientes fuera de rango
      for (const { zone, assignments } of zoneAssignments) {
        if (assignments.length === 0) continue;

        for (const assignment of assignments) {
          processedPlayers++;
          const playerName = assignment.player?.nick || assignment.player?.name || 'Desconocido';
          
          setProgressInfo({
            current: processedPlayers,
            total: totalPlayers,
            zone: zone.name,
            player: playerName,
            created: totalCreated,
            skipped: totalSkipped,
            canceled: totalCanceled
          });
          
          const playerStartStr = assignment.start_date.split('T')[0];
          const playerEndStr = assignment.end_date ? assignment.end_date.split('T')[0] : null;
          const playerStart = new Date(`${playerStartStr}T00:00:00`);
          const playerEnd = playerEndStr ? new Date(`${playerEndStr}T23:59:59`) : seasonEnd;

          const effectiveStart = playerStart > seasonStart ? playerStart : seasonStart;
          const effectiveEnd = playerEnd < seasonEnd ? playerEnd : seasonEnd;

          const expectedDays = new Set();
          if (effectiveStart <= effectiveEnd) {
            const d = new Date(effectiveStart);
            while (d <= effectiveEnd) {
              expectedDays.add(dateKey(d));
              d.setDate(d.getDate() + 1);
            }
          }

          const { data: existingRows, error: existingError } = await supabase
            .from("scheduled_match")
            .select("scheduled_match_id, scheduled_from, status")
            .eq("season_id", seasonId)
            .eq("zone_id", zone.zone_id)
            .eq("player_a_id", assignment.player_id)
            .eq("type", "CW_DAILY");

          if (existingError) {
            console.error(`Error getting existing matches for ${playerName}:`, existingError);
            continue;
          }

          const existingByDay = new Map();
          (existingRows || []).forEach((row) => {
            const rowDay = dateKey(new Date(row.scheduled_from));
            if (!existingByDay.has(rowDay)) {
              existingByDay.set(rowDay, []);
            }
            existingByDay.get(rowDay).push(row);
          });

          for (const day of expectedDays) {
            const scheduledFrom = new Date(`${day}T00:00:00`);
            scheduledFrom.setHours(0, 0, 0, 0);
            
            const scheduledTo = new Date(`${day}T00:00:00`);
            scheduledTo.setHours(23, 59, 59, 999);

            const deadlineAt = new Date(`${day}T00:00:00`);
            deadlineAt.setHours(23, 59, 59, 999);

            if (existingByDay.has(day)) {
              totalSkipped++;
            } else {
              const { error: insertError } = await supabase
                .from("scheduled_match")
                .insert({
                  season_id: seasonId,
                  zone_id: zone.zone_id,
                  player_a_id: assignment.player_id,
                  player_b_id: null,
                  type: "CW_DAILY",
                  stage: "CW_Duel_1v1",
                  best_of: 1,
                  scheduled_from: scheduledFrom.toISOString(),
                  scheduled_to: scheduledTo.toISOString(),
                  deadline_at: deadlineAt.toISOString(),
                  status: "PENDING"
                });

              if (insertError) {
                console.error(`Error creating match for ${assignment.player?.nick || assignment.player?.name}:`, insertError);
              } else {
                totalCreated++;
                // Actualizar el contador de creados en el progreso
                setProgressInfo(prev => ({ ...prev, created: totalCreated }));
              }
            }
          }

          for (const [rowDay, rowsForDay] of existingByDay.entries()) {
            if (expectedDays.has(rowDay)) continue;

            for (const row of rowsForDay) {
              if (row.status !== "PENDING") continue;

              const { error: cancelError } = await supabase
                .from("scheduled_match")
                .update({ status: "CANCELED" })
                .eq("scheduled_match_id", row.scheduled_match_id);

              if (cancelError) {
                console.error(`Error canceling out-of-range match ${row.scheduled_match_id}:`, cancelError);
              } else {
                totalCanceled++;
                setProgressInfo(prev => ({ ...prev, canceled: totalCanceled }));
              }
            }
          }
        }
      }

      setProgressInfo({ current: totalPlayers, total: totalPlayers, zone: 'Completado', player: '', created: totalCreated, skipped: totalSkipped, canceled: totalCanceled });
      
      setTimeout(() => {
        alert(`Reconciliación completada:\n\n✅ ${totalCreated} batallas creadas\n⏭️ ${totalSkipped} batallas ya existían\n🚫 ${totalCanceled} batallas canceladas fuera de rango`);
        setGeneratingDuels(false);
        setProgressInfo({ current: 0, total: 0, zone: '', player: '', created: 0, skipped: 0, canceled: 0 });
      }, 500);
    } catch (error) {
      console.error("Error generating daily duels:", error);
      alert(`Error al generar batallas: ${error.message}`);
      setGeneratingDuels(false);
      setProgressInfo({ current: 0, total: 0, zone: '', player: '', created: 0, skipped: 0, canceled: 0 });
    }
  }

  async function autoLinkBattles(seasonId, testPlayerId = null) {
    const confirmMsg = testPlayerId 
      ? `¿Auto-vincular batallas para jugador ${testPlayerId}?`
      : "¿Auto-vincular batallas para TODOS los jugadores con partidos CW_DAILY pendientes?\n\nEsto buscará y vinculará automáticamente las batallas disponibles para cada jugador.";
    
    if (!confirm(confirmMsg)) return;

    setAutoLinking(true);
    setProgressInfo({ current: 0, total: 0, zone: '', player: '', created: 0, skipped: 0, canceled: 0 });

    try {
      // 1. Obtener todos los scheduled_match CW_DAILY PENDING
      let query = supabase
        .from("scheduled_match")
        .select(`
          scheduled_match_id,
          season_id,
          zone_id,
          player_a_id,
          scheduled_from,
          scheduled_to,
          stage,
          best_of,
          player_a:player!scheduled_match_player_a_id_fkey(player_id, nick, name)
        `)
        .eq("season_id", seasonId)
        .eq("type", "CW_DAILY")
        .eq("status", "PENDING");

      if (testPlayerId) {
        query = query.eq("player_a_id", testPlayerId);
      }

      const { data: matches, error: matchError } = await query;

      if (matchError) throw matchError;

      if (!matches || matches.length === 0) {
        alert("No hay partidos CW_DAILY pendientes para procesar");
        setAutoLinking(false);
        return;
      }

      let linked = 0;
      let skipped = 0;
      const total = matches.length;

      for (let i = 0; i < matches.length; i++) {
        const match = matches[i];
        const playerName = match.player_a?.nick || match.player_a?.name || "Desconocido";

        setProgressInfo({
          current: i + 1,
          total: total,
          zone: '',
          player: playerName,
          created: linked,
          skipped: skipped
        });

        // 2. Buscar batalla disponible del jugador A en el rango de fechas
        const availableBattle = await findAvailableBattle(
          match.player_a_id,
          match.scheduled_from,
          match.scheduled_to,
          match.stage,
          match.scheduled_match_id,
          seasonId
        );

        if (!availableBattle) {
          skipped++;
          continue;
        }

        // 3. Vincular la batalla
        const { error: linkError } = await supabase
          .from("scheduled_match_battle_link")
          .insert({
            scheduled_match_id: match.scheduled_match_id,
            battle_id: availableBattle.battle_id
          });

        if (linkError) {
          console.error(`Error linking battle for match ${match.scheduled_match_id}:`, linkError);
          skipped++;
          continue;
        }

        // 4. Calcular resultado
        const result = await calculateBattleResult(
          availableBattle,
          match.player_a_id,
          match.scheduled_from,
          match.best_of
        );

        if (!result) {
          skipped++;
          continue;
        }

        console.log(`Match ${match.scheduled_match_id} - Result:`, result);

        // 5. Guardar resultado en scheduled_match_result
        const { data: resultData, error: resultError } = await supabase
          .from("scheduled_match_result")
          .upsert({
            scheduled_match_id: match.scheduled_match_id,
            final_score_a: result.final_score_a,
            final_score_b: result.final_score_b,
            points_a: result.points_a,
            points_b: result.points_b,
            decided_by: "ADMIN"
          }, { onConflict: "scheduled_match_id" });

        if (resultError) {
          console.error(`Error saving result for match ${match.scheduled_match_id}:`, resultError);
          skipped++;
          continue;
        }

        console.log(`Saved result for match ${match.scheduled_match_id}:`, resultData);

        // 6. Actualizar scheduled_match con el resultado
        const { error: updateError } = await supabase
          .from("scheduled_match")
          .update({
            score_a: result.final_score_a,
            score_b: result.final_score_b,
            status: "OVERRIDDEN"
          })
          .eq("scheduled_match_id", match.scheduled_match_id);

        if (updateError) {
          console.error(`Error updating match ${match.scheduled_match_id}:`, updateError);
          skipped++;
          continue;
        }

        linked++;
      }

      setProgressInfo({ current: total, total: total, zone: 'Completado', player: '', created: linked, skipped: skipped, canceled: 0 });

      setTimeout(() => {
        alert(`Auto-vinculación completada:\n\n✅ ${linked} batallas vinculadas\n⏭️ ${skipped} omitidas (sin batalla disponible o error)`);
        setAutoLinking(false);
        setProgressInfo({ current: 0, total: 0, zone: '', player: '', created: 0, skipped: 0, canceled: 0 });
      }, 500);
    } catch (error) {
      console.error("Error auto-linking battles:", error);
      alert(`Error al auto-vincular batallas: ${error.message}`);
      setAutoLinking(false);
      setProgressInfo({ current: 0, total: 0, zone: '', player: '', created: 0, skipped: 0, canceled: 0 });
    }
  }

  async function findAvailableBattle(playerId, scheduledFrom, scheduledTo, stage, scheduledMatchId, seasonId) {
    try {
      // Load season cutoff configuration
      const { data: seasonData } = await supabase
        .from("season")
        .select("battle_cutoff_minutes, battle_cutoff_tz_offset")
        .eq("season_id", seasonId)
        .single();

      const cutoffMinutes = seasonData?.battle_cutoff_minutes ?? 590;
      
      // Add ±30 minute buffer to search window
      const bufferedFromTime = new Date(new Date(scheduledFrom).getTime() - 30 * 60 * 1000);
      const bufferedToTime = new Date(new Date(scheduledTo).getTime() + 30 * 60 * 1000);
      
      const fromISO = bufferedFromTime.toISOString();
      const toISO = bufferedToTime.toISOString();

      // Fetch battles already linked to this match
      const { data: linked } = await supabase
        .from("scheduled_match_battle_link")
        .select("battle_id")
        .eq("scheduled_match_id", scheduledMatchId);
      
      const alreadyLinked = (linked || []).map(l => l.battle_id);

      // Get battle_round_player entries for this player
      const { data: brp } = await supabase
        .from("battle_round_player")
        .select("battle_round_id")
        .eq("player_id", playerId)
        .limit(5000);

      if (!brp || brp.length === 0) return null;

      const roundIds = brp.map(r => r.battle_round_id);

      // Get battle_id from those rounds
      const { data: rounds } = await supabase
        .from("battle_round")
        .select("battle_id, battle_round_id")
        .in("battle_round_id", roundIds);

      if (!rounds || rounds.length === 0) return null;

      const battleIds = [...new Set(rounds.map(r => r.battle_id))];

      // Fetch 10 battles in the buffered time range (instead of 1)
      let battleQuery = supabase
        .from("battle")
        .select("battle_id, battle_time, round_count, raw_payload")
        .in("battle_id", battleIds)
        .eq("api_game_mode", stage)
        .gte("battle_time", fromISO)
        .lte("battle_time", toISO)
        .order("battle_time", { ascending: true })
        .limit(10);  // Fetch 10 candidates

      // Exclude already linked battles
      if (alreadyLinked.length > 0) {
        battleQuery = battleQuery.not("battle_id", "in", `(${alreadyLinked.join(",")})`)
      }

      const { data: candidateBattles } = await battleQuery;

      if (!candidateBattles || candidateBattles.length === 0) return null;

      // If only one candidate, return it directly
      if (candidateBattles.length === 1) {
        return candidateBattles[0];
      }

      // Filter by game date using getBattleDateKey
      const scheduledDateKey = getBattleDateKey(scheduledFrom, cutoffMinutes);
      const battlesByDate = candidateBattles.filter(battle => {
        const battleDateKey = getBattleDateKey(battle.battle_time, cutoffMinutes);
        return battleDateKey === scheduledDateKey;
      });

      // If no battles match the exact date, use all candidates
      const battleCandidates = battlesByDate.length > 0 ? battlesByDate : candidateBattles;

      // Use selectBestBattle for disambiguation (if multiple)
      if (battleCandidates.length === 1) {
        return battleCandidates[0];
      }

      // Select best battle using scoring algorithm
      const selected = selectBestBattle(
        battleCandidates,
        scheduledFrom,
        scheduledTo,
        cutoffMinutes,
        3  // Default best_of value (can be enhanced to get from scheduled_match)
      );

      if (selected) {
        // Console logging for disambiguation decisions
        console.log(`[Battle Disambiguation] Match ${scheduledMatchId}:`, {
          player_id: playerId,
          scheduled_date: scheduledDateKey,
          candidates_total: candidateBattles.length,
          candidates_by_date: battleCandidates.length,
          selected_battle_id: selected.battle.battle_id,
          selected_score: selected.score.total,
          decision_reason: selected.reason,
          score_breakdown: selected.score.breakdown,
          alternatives: selected.alternatives.map(alt => ({
            battle_id: alt.battle_id,
            time: alt.battle_time,
            score: alt.score.total
          }))
        });
      }

      return selected?.battle || null;
    } catch (error) {
      console.error("Error finding available battle:", error);
      return null;
    }
  }

  async function calculateBattleResult(battle, playerId, battleDate, bestOf) {
    try {
      // 1. Obtener rounds de la batalla
      const { data: rounds } = await supabase
        .from("battle_round")
        .select("battle_round_id, round_no")
        .eq("battle_id", battle.battle_id);

      if (!rounds || rounds.length === 0) return null;

      const roundIds = rounds.map(r => r.battle_round_id);

      // 2. Obtener datos de los jugadores en cada round
      const { data: roundPlayers } = await supabase
        .from("battle_round_player")
        .select("battle_round_id, player_id, side, crowns, opponent_crowns")
        .in("battle_round_id", roundIds);

      if (!roundPlayers || roundPlayers.length === 0) return null;

      // 3. Calcular resultado por rounds
      const roundNos = [...new Set(rounds.map(r => r.round_no))].sort((a, b) => a - b);

      let teamWins = 0;
      let oppWins = 0;

      roundNos.forEach(rn => {
        const roundIds = rounds.filter(r => r.round_no === rn).map(r => r.battle_round_id);
        const roundPlayerData = roundPlayers.filter(rp => roundIds.includes(rp.battle_round_id));

        const teamData = roundPlayerData.filter(rp => rp.side === "TEAM");
        const oppData = roundPlayerData.filter(rp => rp.side === "OPPONENT");

        const teamCrowns = teamData.reduce((sum, rp) => sum + (rp.crowns || 0), 0);
        const oppCrowns = teamData.reduce((sum, rp) => sum + (rp.opponent_crowns || 0), 0) +
                         oppData.reduce((sum, rp) => sum + (rp.crowns || 0), 0);

        if (teamCrowns > oppCrowns) teamWins++;
        else if (oppCrowns > teamCrowns) oppWins++;
      });

      // 4. Determinar de qué lado está el jugador A
      const playerSide = roundPlayers.find(rp => rp.player_id === playerId)?.side;

      let final_score_a, final_score_b;

      if (playerSide === "TEAM") {
        final_score_a = teamWins;
        final_score_b = oppWins;
      } else {
        final_score_a = oppWins;
        final_score_b = teamWins;
      }

      // 5. Verificar si era extreme/risky ese día
      const isExtremeRisky = await checkExtremeRisky(playerId, battle.battle_time);

      // 6. Calcular puntos según reglas
      // En un BO3 (round_count=3), se necesitan 2 rounds para ganar
      const roundsToWin = Math.ceil(battle.round_count / 2);
      
      let points_a = 0;
      let points_b = 0;

      if (final_score_a === roundsToWin && final_score_b === 0) {
        // 2-0 perfecto
        points_a = isExtremeRisky ? 5 : 4;
      } else if (final_score_a === roundsToWin && final_score_b > 0) {
        // 2-1 ganó pero perdió algún round
        points_a = isExtremeRisky ? 4 : 3;
      } else if (final_score_b === roundsToWin && final_score_a > 0) {
        // 1-2 perdió pero ganó algún round
        points_a = 1;
      } else if (final_score_b === roundsToWin && final_score_a === 0) {
        // 0-2 perdió sin ganar nada
        points_a = 0;
      } else {
        // Otros casos
        if (final_score_a > final_score_b) {
          points_a = isExtremeRisky ? 4 : 3;
        } else if (final_score_a < final_score_b) {
          points_a = final_score_a > 0 ? 1 : 0;
        }
      }

      return {
        final_score_a,
        final_score_b,
        points_a,
        points_b
      };
    } catch (error) {
      console.error("Error calculating battle result:", error);
      return null;
    }
  }

  async function checkExtremeRisky(playerId, battleDate) {
    try {
      // Usar la misma lógica de game day (batalla antes de 09:50 UTC es del día anterior)
      const gameTime = new Date(battleDate);
      gameTime.setUTCMinutes(gameTime.getUTCMinutes() - 590); // -9h 50min
      const battleDateStr = gameTime.toISOString().split('T')[0];

      // Buscar si el jugador estaba en extreme/risky ese día
      const { data: participants } = await supabase
        .from('season_extreme_participant')
        .select('participant_type, start_date, end_date')
        .eq('player_id', playerId);

      if (!participants || participants.length === 0) return false;

      // Filtrar por fecha
      const participant = participants.find(p => {
        const startDate = p.start_date ? new Date(p.start_date).toISOString().split('T')[0] : null;
        const endDate = p.end_date ? new Date(p.end_date).toISOString().split('T')[0] : null;

        const afterStart = !startDate || battleDateStr >= startDate;
        const beforeEnd = !endDate || battleDateStr <= endDate;

        return afterStart && beforeEnd;
      });

      return !!participant;
    } catch (error) {
      console.error("Error checking extreme/risky:", error);
      return false;
    }
  }

  return (
    <div className="bg-[#f6f6f8] dark:bg-[#101622] font-display min-h-screen flex flex-col overflow-x-hidden antialiased transition-colors duration-300">
      {/* Modal de progreso */}
      {(generatingDuels || autoLinking) && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#1a1f2e] rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="animate-spin">
                <span className="material-symbols-outlined text-[#1152d4] text-3xl">
                  progress_activity
                </span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {generatingDuels ? "Generando Batallas Diarias" : "Auto-vinculando Batallas"}
              </h3>
            </div>
            
            {/* Barra de progreso */}
            <div className="mb-4">
              <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
                <span>Jugador {progressInfo.current} de {progressInfo.total}</span>
                <span>{progressInfo.total > 0 ? Math.round((progressInfo.current / progressInfo.total) * 100) : 0}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                <div 
                  className="bg-[#1152d4] h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${progressInfo.total > 0 ? (progressInfo.current / progressInfo.total) * 100 : 0}%` }}
                />
              </div>
            </div>
            
            {/* Detalles del progreso */}
            <div className="space-y-2 text-sm">
              {progressInfo.zone && (
                <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                  <span className="material-symbols-outlined text-base">
                    location_on
                  </span>
                  <span className="font-medium">Zona:</span>
                  <span>{progressInfo.zone}</span>
                </div>
              )}
              {progressInfo.player && (
                <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                  <span className="material-symbols-outlined text-base">
                    person
                  </span>
                  <span className="font-medium">Jugador:</span>
                  <span>{progressInfo.player}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <span className="material-symbols-outlined text-base">
                  check_circle
                </span>
                <span className="font-medium">Creadas:</span>
                <span>{progressInfo.created}</span>
              </div>
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                <span className="material-symbols-outlined text-base">
                  skip_next
                </span>
                <span className="font-medium">Omitidas:</span>
                <span>{progressInfo.skipped}</span>
              </div>
              {generatingDuels && (
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                  <span className="material-symbols-outlined text-base">
                    cancel
                  </span>
                  <span className="font-medium">Canceladas:</span>
                  <span>{progressInfo.canceled || 0}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Top App Bar */}
      <header className="sticky top-0 z-50 w-full bg-[#f6f6f8]/90 dark:bg-[#101622]/90 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between px-4 py-3 max-w-7xl mx-auto w-full">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Temporadas</h1>

          <button
            onClick={() => nav("/admin/seasons/new")}
            className="group flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-[#1152d4] text-white hover:bg-[#1152d4]/90 active:scale-95 transition-all shadow-lg shadow-[#1152d4]/20"
            aria-label="Agregar temporada"
          >
            <span className="material-symbols-outlined font-semibold group-hover:rotate-90 transition-transform duration-300">
              add
            </span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-[1600px] mx-auto p-4 flex flex-col gap-4">
        <div className="flex items-center justify-between pb-2">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Temporada Actual
          </p>
        </div>

        {loading ? (
          <div className="text-gray-500 dark:text-gray-300">Cargando...</div>
        ) : !activeSeason ? (
          <article className="rounded-xl bg-white dark:bg-[#1e2736] shadow-sm border border-gray-100 dark:border-gray-800 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                  <span className="material-symbols-outlined text-xl">info</span>
                </div>
                <div>
                  <h2 className="text-base font-semibold text-gray-900 dark:text-white">No hay temporada activa</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Creá una temporada y marcala como <b>ACTIVE</b>.
                  </p>
                </div>
              </div>

              <button
                onClick={() => nav("/admin/seasons/new")}
                className="h-9 px-3 rounded-lg bg-gray-100 dark:bg-gray-800 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                Crear
              </button>
            </div>
          </article>
        ) : (
          <article className="relative overflow-hidden rounded-xl bg-white dark:bg-[#1e2736] shadow-md border-l-4 border-[#1152d4]">
            <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-[#1152d4]/10 rounded-full blur-2xl"></div>

            <div className="relative p-5 flex flex-col gap-4">
              <div className="flex items-start justify-between">
                <div className="flex gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#1152d4]/10 text-[#1152d4]">
                    <span className="material-symbols-outlined text-[28px] fill-1">emoji_events</span>
                  </div>

                  <div className="flex flex-col">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">
                      {activeSeason.description}
                    </h2>

                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {statusBadge(activeSeason.status)}
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {fmtDateRange(activeSeason)}
                      </span>
                      {activeSeason?.era?.description ? (
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          • {activeSeason.era.description}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => nav(`/admin/seasons/${activeSeason.season_id}`)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
                    aria-label="Editar temporada"
                  >
                    <span className="material-symbols-outlined">edit</span>
                  </button>

                  <button
                    onClick={() => onDelete(activeSeason)}
                    className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
                    aria-label="Eliminar temporada"
                  >
                    <span className="material-symbols-outlined">delete</span>
                  </button>
                </div>
              </div>

              <div className="flex flex-col w-full gap-2">
                {/* Primera fila de botones */}
                <div className="flex w-full gap-3">
                  <button
                    onClick={() => nav(`/admin/seasons/${activeSeason.season_id}/zones`)}
                    className="flex-1 flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#1152d4] py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#1152d4]/90 active:translate-y-0.5 transition-all"
                  >
                    <span className="material-symbols-outlined">grid_view</span>
                    <span>Ver Zonas</span>
                  </button>

                  <button
                    onClick={() => nav(`/admin/seasons/${activeSeason.season_id}/assignments`)}
                    className="flex-1 flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-white/5 text-sm font-bold text-[#1152d4] shadow-sm hover:bg-white/10 active:translate-y-0.5 transition-all"
                  >
                    <span className="material-symbols-outlined">person_add</span>
                    <span>Asignar jugadores</span>
                  </button>
                  
                  <button
                    onClick={() => nav(`/admin/seasons/${activeSeason.season_id}/cup-modes`)}
                    className="flex-1 flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-white/5 text-sm font-bold text-[#1152d4] shadow-sm hover:bg-white/10 active:translate-y-0.5 transition-all"
                  >
                    <span className="material-symbols-outlined">sports_esports</span>
                    <span>Configurar Copas</span>
                  </button>

                  <button
                    onClick={() => nav(`/admin/seasons/${activeSeason.season_id}/cup-matches`)}
                    className="flex-1 flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-white/5 text-sm font-bold text-[#1152d4] shadow-sm hover:bg-white/10 active:translate-y-0.5 transition-all"
                  >
                    <span className="material-symbols-outlined">event</span>
                    <span>Partidas</span>
                  </button>

                  <button
                    onClick={() => nav(`/admin/seasons/${activeSeason.season_id}/daily-points`)}
                    className="flex-1 flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-emerald-500/20 text-sm font-bold text-emerald-600 dark:text-emerald-400 shadow-sm hover:bg-emerald-500/30 active:translate-y-0.5 transition-all"
                    title="Ver resumen diario de puntos por jugador"
                  >
                    <span className="material-symbols-outlined">view_week</span>
                    <span>Resumen Diario</span>
                  </button>
                </div>

                {/* Segunda fila de botones */}
                <div className="flex w-full gap-3">
                  <button
                    onClick={() => generateDailyDuels(activeSeason.season_id)}
                    disabled={generatingDuels}
                    className="flex-1 flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-purple-500/20 text-sm font-bold text-purple-600 dark:text-purple-400 shadow-sm hover:bg-purple-500/30 active:translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Generar batallas de duelo diario (CW_Duel_1v1)"
                  >
                    <span className="material-symbols-outlined">{generatingDuels ? 'hourglass_empty' : 'auto_awesome'}</span>
                    <span>{generatingDuels ? 'Generando...' : 'Generar Duelos'}</span>
                  </button>

                  <button
                    onClick={() => autoLinkBattles(activeSeason.season_id)}
                    disabled={autoLinking}
                    className="flex-1 flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-orange-500/20 text-sm font-bold text-orange-600 dark:text-orange-400 shadow-sm hover:bg-orange-500/30 active:translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Auto-vincular batallas a partidos CW_DAILY pendientes"
                  >
                    <span className="material-symbols-outlined">{autoLinking ? 'hourglass_empty' : 'link'}</span>
                    <span>{autoLinking ? 'Vinculando...' : 'Auto-vincular'}</span>
                  </button>

                  <button
                    onClick={() => nav(`/admin/seasons/${activeSeason.season_id}/group-standings`)}
                    className="flex-1 flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-white/5 text-sm font-bold text-teal-600 dark:text-teal-400 shadow-sm hover:bg-white/10 active:translate-y-0.5 transition-all"
                  >
                    <span className="material-symbols-outlined">leaderboard</span>
                    <span>Posiciones</span>
                  </button>

                  <button
                    onClick={() => nav(`/admin/seasons/${activeSeason.season_id}/extreme`)}
                    className="flex-1 flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-white/5 text-sm font-bold text-red-600 dark:text-red-400 shadow-sm hover:bg-white/10 active:translate-y-0.5 transition-all"
                  >
                    <span className="material-symbols-outlined">local_fire_department</span>
                    <span>Extreme</span>
                  </button>

                  <button
                    onClick={() => nav(`/admin/seasons/${activeSeason.season_id}/restrictions`)}
                    className="flex-1 flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-white/5 text-sm font-bold text-amber-600 dark:text-amber-400 shadow-sm hover:bg-white/10 active:translate-y-0.5 transition-all"
                    title="Gestionar restricciones de cartas (RES)"
                  >
                    <span className="material-symbols-outlined">block</span>
                    <span>Restricciones</span>
                  </button>
                </div>
              </div>
            </div>
          </article>
        )}

        {/* Divider */}
        <div className="flex items-center justify-between pt-4 pb-2">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Historial
          </p>
        </div>

        {!loading && history.length === 0 ? (
          <div className="flex justify-center pt-4 pb-8">
            <span className="text-xs text-gray-400 dark:text-gray-600 font-medium">No hay más temporadas</span>
          </div>
        ) : (
          history.map((s, idx) => {
            const isOlder = idx >= 2;
            return (
              <article
                key={s.season_id}
                className={[
                  "group relative flex flex-col rounded-xl bg-white dark:bg-[#1e2736] shadow-sm border border-gray-100 dark:border-gray-800 transition-all hover:border-gray-300 dark:hover:border-gray-700",
                  isOlder ? "opacity-75 hover:opacity-100" : "",
                ].join(" ")}
              >
                <div className="p-4 flex items-center gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 group-hover:bg-gray-200 dark:group-hover:bg-gray-700 transition-colors">
                    <span className="material-symbols-outlined text-xl">{isOlder ? "history" : "event_available"}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1 gap-2">
                      <h3 className="text-base font-semibold text-gray-900 dark:text-white truncate">
                        {s.description}
                      </h3>
                      {statusBadge(s.status)}
                    </div>

                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {fmtDateRange(s)}
                      {s?.era?.description ? ` • ${s.era.description}` : ""}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => nav(`/admin/seasons/${s.season_id}/zones`)}
                      className="h-8 px-3 rounded-lg bg-gray-100 dark:bg-gray-800 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
                    >
                      <span className="material-symbols-outlined text-base">grid_view</span>
                      <span>Ver Zonas</span>
                    </button>

                    <button
                      onClick={() => nav(`/admin/seasons/${s.season_id}/assignments`)}
                      className="h-8 px-3 rounded-lg bg-white/5 text-xs font-medium text-[#1152d4] hover:bg-white/10 transition-colors flex items-center gap-2"
                    >
                      <span className="material-symbols-outlined text-base">person_add</span>
                      <span>Asignar</span>
                    </button>

                    <button
                      onClick={() => nav(`/admin/seasons/${s.season_id}/cup-modes`)}
                      className="h-8 px-3 rounded-lg bg-white/5 text-xs font-medium text-[#1152d4] hover:bg-white/10 transition-colors flex items-center gap-2"
                    >
                      <span className="material-symbols-outlined text-base">sports_esports</span>
                      <span>Copas</span>
                    </button>

                    <button
                      onClick={() => nav(`/admin/seasons/${s.season_id}/extreme`)}
                      className="h-8 px-3 rounded-lg bg-white/5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-white/10 transition-colors flex items-center gap-2"
                    >
                      <span className="material-symbols-outlined text-base">local_fire_department</span>
                      <span>Extreme</span>
                    </button>

                    <button
                      onClick={() => nav(`/admin/seasons/${s.season_id}/restrictions`)}
                      className="h-8 px-3 rounded-lg bg-white/5 text-xs font-medium text-amber-600 dark:text-amber-400 hover:bg-white/10 transition-colors flex items-center gap-2"
                      title="Restricciones"
                    >
                      <span className="material-symbols-outlined text-base">block</span>
                      <span>Restricciones</span>
                    </button>

                    <button
                      onClick={() => nav(`/admin/seasons/${s.season_id}/cup-matches`)}
                      className="h-8 px-3 rounded-lg bg-white/5 text-xs font-medium text-[#1152d4] hover:bg-white/10 transition-colors flex items-center gap-2"
                    >
                      <span className="material-symbols-outlined text-base">swords</span>
                      <span>Partidas</span>
                    </button>

                    <button
                      onClick={() => nav(`/admin/seasons/${s.season_id}/group-standings`)}
                      className="h-8 px-3 rounded-lg bg-white/5 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:bg-white/10 transition-colors flex items-center gap-2"
                    >
                      <span className="material-symbols-outlined text-base">leaderboard</span>
                      <span>Posiciones</span>
                    </button>

                    <button
                      onClick={() => nav(`/admin/seasons/${s.season_id}`)}
                      className="h-8 w-8 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors"
                      aria-label="Editar"
                    >
                      <span className="material-symbols-outlined text-xl">edit</span>
                    </button>

                    <button
                      onClick={() => onDelete(s)}
                      className="h-8 w-8 flex items-center justify-center text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors"
                      aria-label="Eliminar"
                    >
                      <span className="material-symbols-outlined text-xl">delete</span>
                    </button>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </main>
    </div>
  );
}
