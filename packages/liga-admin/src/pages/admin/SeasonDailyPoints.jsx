import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { buildDailyPointsGrid } from "../../lib/dailyPointsUtils";

function formatDate(dateStr) {
  if (!dateStr) return "";
  const date = new Date(`${dateStr}T00:00:00Z`);
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${day}/${month}`;
}

export default function SeasonDailyPoints() {
  const { seasonId } = useParams();
  const nav = useNavigate();

  const [loading, setLoading] = useState(true);
  const [season, setSeason] = useState(null);
  const [matches, setMatches] = useState([]);
  const [players, setPlayers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [zones, setZones] = useState([]);
  const [battleCutoffMinutes, setBattleCutoffMinutes] = useState(590);

  const [searchPlayer, setSearchPlayer] = useState("");
  const [filterTeamId, setFilterTeamId] = useState("");
  const [filterZoneId, setFilterZoneId] = useState("");

  useEffect(() => {
    loadData();
  }, [seasonId, filterZoneId]);

  async function loadData() {
    setLoading(true);

    const { data: seasonData, error: seasonErr } = await supabase
      .from("season")
      .select("season_id,description,season_start_at,season_end_at,duel_start_date,battle_cutoff_minutes,days_per_round")
      .eq("season_id", seasonId)
      .maybeSingle();

    if (seasonErr) {
      alert(`Error cargando temporada: ${seasonErr.message}`);
      setLoading(false);
      return;
    }

    setSeason(seasonData);
    const cutoff = seasonData?.battle_cutoff_minutes ?? 590;
    console.log('🔍 SeasonDailyPoints - Loading cutoff:', cutoff, 'from season:', seasonData?.description);
    setBattleCutoffMinutes(cutoff);

    const { data: zonesData, error: zonesErr } = await supabase
      .from("season_zone")
      .select("zone_id, name")
      .eq("season_id", seasonId);

    if (zonesErr) {
      alert(`Error cargando zonas: ${zonesErr.message}`);
      setLoading(false);
      return;
    }

    setZones(zonesData || []);

    let matchQuery = supabase
      .from("scheduled_match")
      .select(`
        scheduled_match_id,
        type,
        zone_id,
        player_a_id,
        scheduled_from,
        scheduled_to,
        result:scheduled_match_result!scheduled_match_id(
          points_a
        )
      `)
      .eq("season_id", seasonId)
      .eq("type", "CW_DAILY");

    if (filterZoneId) {
      matchQuery = matchQuery.eq("zone_id", filterZoneId);
    }

    const { data: matchesData, error: matchesErr } = await matchQuery;

    if (matchesErr) {
      alert(`Error cargando partidos: ${matchesErr.message}`);
      setLoading(false);
      return;
    }

    setMatches(matchesData || []);

    let assignmentQuery = supabase
      .from("season_zone_team_player")
      .select(`
        player_id,
        team_id,
        zone_id,
        jersey_no,
        start_date,
        end_date,
        player:player!player_id(
          player_id,
          nick
        ),
        team:team!team_id(
          team_id,
          name,
          logo
        )
      `);

    if (filterZoneId) {
      assignmentQuery = assignmentQuery.eq("zone_id", filterZoneId);
    } else {
      const zoneIds = (zonesData || []).map((zone) => zone.zone_id);
      if (zoneIds.length > 0) {
        assignmentQuery = assignmentQuery.in("zone_id", zoneIds);
      }
    }

    const { data: assignmentsData, error: assignmentsErr } = await assignmentQuery;

    if (assignmentsErr) {
      alert(`Error cargando asignaciones: ${assignmentsErr.message}`);
      setLoading(false);
      return;
    }

    const playerMap = {};
    (assignmentsData || []).forEach((assignment) => {
      if (playerMap[assignment.player_id]) return;

      playerMap[assignment.player_id] = {
        player_id: assignment.player_id,
        nickname: assignment.player?.nick || "Desconocido",
        team: assignment.team,
        jersey_no: assignment.jersey_no,
        start_date: assignment.start_date,
        end_date: assignment.end_date,
      };
    });

    setPlayers(Object.values(playerMap));

    const { data: teamsData, error: teamsErr } = await supabase
      .from("team")
      .select("team_id, name")
      .order("name", { ascending: true });

    if (teamsErr) {
      alert(`Error cargando equipos: ${teamsErr.message}`);
    } else {
      setTeams(teamsData || []);
    }

    setLoading(false);
  }

  // `buildDailyPointsGrid` centralizes round grouping and consecutive miss penalties.
  // Example streak: miss, miss, play, miss => -1, -2, reset, -1; at 4 misses player is excluded.
  const gridData = useMemo(
    () => {
      console.log('🔍 SeasonDailyPoints - Building grid with cutoff:', battleCutoffMinutes);
      return buildDailyPointsGrid({
        season,
        matches,
        players,
        searchPlayer,
        filterTeamId,
        battleCutoffMinutes,
      });
    },
    [season, matches, players, searchPlayer, filterTeamId, battleCutoffMinutes]
  );

  function getPointsColor(points) {
    if (points === null) return "bg-gray-100 dark:bg-gray-800 text-gray-400";
    if (points < 0) return "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 font-bold";
    if (points === 0) return "bg-gray-50 dark:bg-gray-900 text-gray-500";
    if (points >= 5) return "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-bold";
    if (points >= 3) return "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-semibold";
    return "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 font-medium";
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 bg-[#f6f6f8] dark:bg-[#101622]">
        <div className="text-slate-600 dark:text-slate-300">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full min-h-screen bg-[#f6f6f8] dark:bg-[#101622]">
      <div className="sticky top-0 z-20 flex items-center justify-between w-full bg-white dark:bg-[#1c2333] border-b border-slate-200 dark:border-slate-800 px-5 py-4 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => nav(`/admin/seasons/${seasonId}`)}
            className="flex size-10 shrink-0 items-center justify-center rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Volver"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div>
            <h1 className="text-slate-900 dark:text-white text-lg font-bold leading-tight">Resumen Diario de Puntos</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm">{season?.description}</p>
          </div>
        </div>
      </div>

      <div className="w-full bg-white dark:bg-[#1c2333] border-b border-slate-200 dark:border-slate-800 px-5 py-4">
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Buscar jugador..."
              value={searchPlayer}
              onChange={(event) => setSearchPlayer(event.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f1623] text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-[#1152d4] focus:ring-1 focus:ring-[#1152d4] transition-all"
            />
          </div>

          <div className="flex-1 min-w-[200px]">
            <select
              value={filterTeamId}
              onChange={(event) => setFilterTeamId(event.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f1623] text-slate-900 dark:text-white focus:border-[#1152d4] focus:ring-1 focus:ring-[#1152d4] transition-all"
            >
              <option value="">Todos los equipos</option>
              {teams.map((team) => (
                <option key={team.team_id} value={team.team_id}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-w-[200px]">
            <select
              value={filterZoneId}
              onChange={(event) => setFilterZoneId(event.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f1623] text-slate-900 dark:text-white focus:border-[#1152d4] focus:ring-1 focus:ring-[#1152d4] transition-all"
            >
              <option value="">Todas las zonas</option>
              {zones.map((zone) => (
                <option key={zone.zone_id} value={zone.zone_id}>
                  {zone.name}
                </option>
              ))}
            </select>
          </div>

          {(searchPlayer || filterTeamId || filterZoneId) && (
            <button
              onClick={() => {
                setSearchPlayer("");
                setFilterTeamId("");
                setFilterZoneId("");
              }}
              className="h-10 px-4 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-sm font-medium"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 w-full overflow-auto p-5">
        {gridData.rows.length === 0 ? (
          <div className="bg-white dark:bg-[#1c2333] rounded-xl border border-slate-200 dark:border-slate-800 p-8 text-center">
            <p className="text-slate-500 dark:text-slate-400">No hay datos para mostrar con los filtros aplicados.</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-[#1c2333] rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-100 dark:bg-[#162238] border-b border-slate-200 dark:border-slate-700">
                    <th
                      rowSpan={2}
                      className="sticky left-0 z-20 bg-slate-100 dark:bg-[#162238] px-4 py-3 text-left text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider border-r border-slate-200 dark:border-slate-700"
                    >
                      Jugador
                    </th>
                    <th
                      rowSpan={2}
                      className="px-4 py-3 text-left text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider border-r border-slate-200 dark:border-slate-700"
                    >
                      Equipo
                    </th>
                    {gridData.rounds.map((round) => (
                      <th
                        key={`round-${round.number}`}
                        colSpan={round.dates.length}
                        className="px-2 py-2 text-center text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider border-r border-slate-200 dark:border-slate-700 bg-slate-200/80 dark:bg-slate-700/40 round-header"
                      >
                        Ronda {round.number}
                      </th>
                    ))}
                    <th
                      rowSpan={2}
                      className="sticky right-0 z-20 bg-slate-100 dark:bg-[#162238] px-4 py-3 text-center text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider border-l-2 border-slate-300 dark:border-slate-600"
                    >
                      Total
                    </th>
                  </tr>
                  <tr className="bg-slate-50 dark:bg-[#0f1623] border-b border-slate-200 dark:border-slate-700">
                    {gridData.dates.map((dateKey) => (
                      <th
                        key={`date-${dateKey}`}
                        className="px-2 py-3 text-center text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider border-r border-slate-200 dark:border-slate-700 min-w-[60px]"
                      >
                        {formatDate(dateKey)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {gridData.rows.map((row, rowIdx) => (
                    <tr
                      key={row.player_id}
                      className={[
                        "border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors",
                        rowIdx % 2 === 0 ? "bg-white dark:bg-[#1c2333]" : "bg-slate-50/50 dark:bg-[#0f1623]/50",
                      ].join(" ")}
                    >
                      <td className="sticky left-0 z-10 bg-inherit px-4 py-2 text-sm font-semibold text-slate-900 dark:text-white border-r border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 dark:text-slate-400 text-xs font-mono">{row.jersey_no}</span>
                          <span>{row.nickname}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 border-r border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-2">
                          {row.team_logo ? (
                            <img src={row.team_logo} alt={row.team} className="w-6 h-6 rounded-full object-cover" />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700" />
                          )}
                          <span>{row.team}</span>
                        </div>
                      </td>
                      {row.datePoints.map((points, index) => (
                        <td
                          key={`${row.player_id}-${index}`}
                          className={[
                            "px-2 py-2 text-center text-sm border-r border-slate-200 dark:border-slate-700",
                            getPointsColor(points),
                          ].join(" ")}
                        >
                          {points !== null ? points : "-"}
                        </td>
                      ))}
                      <td className="sticky right-0 z-10 bg-inherit px-4 py-2 text-center text-sm font-bold text-slate-900 dark:text-white border-l-2 border-slate-300 dark:border-slate-600">
                        {row.total}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div className="w-full bg-white dark:bg-[#1c2333] border-t border-slate-200 dark:border-slate-800 px-5 py-4">
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <span className="text-slate-600 dark:text-slate-400 font-semibold">Leyenda:</span>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700"></div>
            <span className="text-slate-600 dark:text-slate-400">≥ 5 puntos</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700"></div>
            <span className="text-slate-600 dark:text-slate-400">3-4 puntos</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700"></div>
            <span className="text-slate-600 dark:text-slate-400">1-2 puntos</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700"></div>
            <span className="text-slate-600 dark:text-slate-400">0 puntos</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700"></div>
            <span className="text-slate-600 dark:text-slate-400">Penalización: 1ra falta -1, 2da -2, 3ra -5, 4ta+ -10</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600"></div>
            <span className="text-slate-600 dark:text-slate-400">Jugador inactivo</span>
          </div>
          <span className="text-slate-600 dark:text-slate-400">Los jugadores se excluyen de la grilla tras 4 faltas consecutivas.</span>
        </div>
      </div>
    </div>
  );
}
