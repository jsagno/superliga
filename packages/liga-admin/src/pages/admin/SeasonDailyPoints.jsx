import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

function formatDate(dateStr) {
  if (!dateStr) return "";
  // Usar UTC para evitar desplazamientos por timezone
  const d = new Date(dateStr + "T00:00:00Z");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${day}/${month}`;
}

function getDateKey(timestamptz) {
  // Convertir timestamp a fecha del "día del juego"
  // Las batallas antes de 09:50 UTC son del día anterior
  if (!timestamptz) return null;
  
  const gameTime = new Date(timestamptz);
  // Restar 9h 50min para obtener el día del juego
  gameTime.setUTCMinutes(gameTime.getUTCMinutes() - 590);
  
  // Usar UTC para la fecha (no local)
  const yyyy = gameTime.getUTCFullYear();
  const mm = String(gameTime.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(gameTime.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function isSameDay(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
}

function isPlayerActiveOnDate(player, dateStr) {
  const checkDate = new Date(dateStr);
  
  // Si tiene start_date, verificar que no sea antes
  if (player.start_date) {
    const startDate = new Date(player.start_date);
    if (checkDate < startDate) return false;
  }
  
  // Si tiene end_date, verificar que no sea después
  if (player.end_date) {
    const endDate = new Date(player.end_date);
    if (checkDate > endDate) return false;
  }
  
  return true;
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

  // Filtros
  const [searchPlayer, setSearchPlayer] = useState("");
  const [filterTeamId, setFilterTeamId] = useState("");
  const [filterZoneId, setFilterZoneId] = useState("");

  useEffect(() => {
    loadData();
  }, [seasonId]);

  async function loadData() {
    setLoading(true);

    // 1. Cargar temporada
    const { data: seasonData, error: seasonErr } = await supabase
      .from("season")
      .select("season_id, description, season_start_at, season_end_at, duel_start_date")
      .eq("season_id", seasonId)
      .maybeSingle();

    if (seasonErr) {
      alert("Error cargando temporada: " + seasonErr.message);
      setLoading(false);
      return;
    }

    setSeason(seasonData);

    // 2. Cargar todos los scheduled_match con sus batallas y resultados
    let query = supabase
      .from("scheduled_match")
      .select(`
        scheduled_match_id,
        type,
        player_a_id,
        player_b_id,
        linked_battles:scheduled_match_battle_link!scheduled_match_id(
          battle:battle!battle_id(
            battle_time
          )
        ),
        result:scheduled_match_result!scheduled_match_id(
          points_a
        ),
        scheduled_from,
        scheduled_to
      `)
      .eq("season_id", seasonId);

    // Solo filtrar por zona si está seleccionada
    if (filterZoneId) {
      query = query.eq("zone_id", filterZoneId);
    }

    const { data: matchesData, error: matchesErr } = await query.eq("type", "CW_DAILY");

    if (matchesErr) {
      alert("Error cargando partidos: " + matchesErr.message);
      setLoading(false);
      return;
    }

    console.log("Total scheduled_match cargados:", matchesData?.length);
    console.log("Matches con linked_battles:", matchesData?.filter(m => m.linked_battles?.length > 0).length);
    
    
    // DEBUG: Ver todos los matches del jugador debug
    const debugPlayerId = "ff82c140-7a65-4ad6-a479-3ed992d97e31";
    const debugMatches = matchesData?.filter(m => m.player_a_id === debugPlayerId);
    console.log(debugMatches);
    console.log(`Matches del jugador debug: ${debugMatches?.length}`);
    console.log("  - Con linked_battles:", debugMatches?.filter(m => m.linked_battles?.length > 0).length);
    console.log("  - Sin linked_battles:", debugMatches?.filter(m => !m.linked_battles || m.linked_battles.length === 0).length);
    
    // DEBUG: Verificar si hay batallas del jugador que NO están en scheduled_match
    console.log("\n🔍 Buscando todas las batallas del jugador en el rango de fechas...");
    
    // Primero obtener los battle_ids del jugador
    const { data: playerBattleIds, error: pbErr } = await supabase
      .from("battle_round_player")
      .select("battle_id")
      .eq("player_id", debugPlayerId);
    
    if (!pbErr && playerBattleIds && playerBattleIds.length > 0) {
      // Luego cargar las batallas con esos IDs
      const battleIds = playerBattleIds.map(pb => pb.battle_id);
      const { data: battles, error: bErr } = await supabase
        .from("battle")
        .select("battle_id, battle_time, api_game_mode")
        .in("battle_id", battleIds.slice(0, 1000)) // Limitar a 1000 para evitar error de URL
        .order("battle_time", { ascending: true });
      
      if (!bErr && battles) {
        const seasonStart = seasonData.duel_start_date || seasonData.season_start_at;
        const seasonEnd = seasonData.season_end_at;
        
        const battlesInSeason = battles
          .filter(b => b.battle_time >= seasonStart && b.battle_time <= seasonEnd);
        
        console.log(`Batallas directas del jugador en temporada: ${battlesInSeason.length}`);
        battlesInSeason.forEach((b, idx) => {
          const dateKey = getDateKey(b.battle_time);
          console.log(`  [${idx + 1}] ${dateKey} - ${b.api_game_mode} - ${b.battle_time}`);
        });
      }
    }

    setMatches(matchesData || []);

    // 3. Cargar zonas de la temporada
    const { data: zonesData, error: zonesErr } = await supabase
      .from("season_zone")
      .select("zone_id, name")
      .eq("season_id", seasonId);

    if (zonesErr) {
      alert("Error cargando zonas: " + zonesErr.message);
      setLoading(false);
      return;
    }
    else{
      setZones(zonesData);
    }

    const zoneIds = (zonesData || []).map(z => z.zone_id);

    // 4. Cargar asignaciones de jugadores a equipos (season_zone_team_player)
    let queryAssignments = supabase
      .from("season_zone_team_player")
      .select(`
        player_id,
        team_id,
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
      `)
    // Solo filtrar por zona si está seleccionada
    if (filterZoneId) {
      queryAssignments = queryAssignments.eq("zone_id", filterZoneId);
    }
    else{
      queryAssignments = queryAssignments.in("zone_id", zoneIds);
    }

    const { data: assignmentsData, error: assignmentsErr } = await queryAssignments
      

    if (assignmentsErr) {
      alert("Error cargando asignaciones: " + assignmentsErr.message);
      setLoading(false);
      return;
    }

    // Crear array de jugadores únicos con su equipo (tomando el más reciente)
    const playerMap = {};
    (assignmentsData || []).forEach(assignment => {
      const playerId = assignment.player_id;
      if (!playerMap[playerId]) {
        playerMap[playerId] = {
          player_id: playerId,
          nickname: assignment.player?.nick || "Desconocido",
          team: assignment.team,
          jersey_no: assignment.jersey_no,
          start_date: assignment.start_date,
          end_date: assignment.end_date
        };
      }
    });

    const playersArray = Object.values(playerMap);
    setPlayers(playersArray);

    // 5. Cargar equipos para el filtro
    const { data: teamsData, error: teamsErr } = await supabase
      .from("team")
      .select("team_id, name")
      .order("name", { ascending: true });

    if (teamsErr) {
      alert("Error cargando equipos: " + teamsErr.message);
    } else {
      setTeams(teamsData || []);
    }

    setLoading(false);
  }

  

  // Calcular datos de la grilla
  const gridData = useMemo(() => {
    if (!season || matches.length === 0) return { dates: [], rows: [] };

    // Obtener todas las fechas únicas de las batallas
    const datesSet = new Set();
    const seasonStartDate = season.duel_start_date || season.season_start_at;
    const seasonEndDate = season.season_end_at;

    matches.forEach(m => {
      if (m.linked_battles && m.linked_battles.length > 0 && m.linked_battles[0].battle) {
        const battleTime = m.linked_battles[0].battle.battle_time;
        if (battleTime) {
          const dateKey = getDateKey(battleTime);
          // Solo incluir fechas dentro del rango de la temporada
          if (dateKey && dateKey >= seasonStartDate && dateKey <= seasonEndDate) {
            datesSet.add(dateKey);
          }
        }
      }
    });

    const dates = Array.from(datesSet).sort();

    // Crear un mapa de jugador -> fecha -> puntos
    const playerDatePoints = {};

    // DEBUG: ID del jugador a analizar
    const debugPlayerId = "ff82c140-7a65-4ad6-a479-3ed992d97e31";
    const debugBattles = [];

    // Procesar todos los partidos
    matches.forEach(match => {
      // Obtener la fecha de la batalla
      if (!match.linked_battles || match.linked_battles.length === 0 || !match.linked_battles[0].battle) {
        return; // Sin batalla, saltar
      }

      const battleTime = match.linked_battles[0].battle.battle_time;
      if (!battleTime) return;

      const dateKey = getDateKey(battleTime);
      
      // Procesar player_a (único jugador que nos interesa en CW_DAILY)
      if (match.player_a_id) {
        // DEBUG: Acumular batallas del jugador específico
        if (match.player_a_id === debugPlayerId) {
          debugBattles.push({
            scheduled_match_id: match.scheduled_match_id,
            battle_time_raw: battleTime,
            dateKey: dateKey,
            points_a: match.result?.points_a || "sin resultado",
            linked_battles_count: match.linked_battles?.length || 0,
            match: match
          });
        }

        if (!playerDatePoints[match.player_a_id]) {
          playerDatePoints[match.player_a_id] = {};
        }
        if (!playerDatePoints[match.player_a_id][dateKey]) {
          playerDatePoints[match.player_a_id][dateKey] = { points: 0, matches: 0 };
        }

        // Si hay batalla vinculada, significa que SÍ jugó (tenga o no resultado)
        playerDatePoints[match.player_a_id][dateKey].matches += 1;

        // scheduled_match_result es un objeto único, no un array
        if (match.result) {
          // Hay resultado registrado, sumar puntos
          playerDatePoints[match.player_a_id][dateKey].points += match.result.points_a || 0;
        }
      }
    });

    // DEBUG: Mostrar batallas ordenadas por fecha
    // Solo mostrar si se está filtrando por el jugador específico
    const debugPlayer = players.find(p => p.player_id === debugPlayerId);
    const showDebug = debugPlayer && searchPlayer && 
                     debugPlayer.nickname.toLowerCase().includes(searchPlayer.toLowerCase());
    
    if (debugBattles.length > 0 && showDebug) {
      debugBattles.sort((a, b) => a.battle_time_raw.localeCompare(b.battle_time_raw));
      console.log("=== BATALLAS DEL JUGADOR DEBUG (ordenadas por fecha) ===");
      console.log(`Total de batallas: ${debugBattles.length}`);
      
      // Agrupar por scheduled_match_id para ver duplicados
      const matchGroups = {};
      debugBattles.forEach(b => {
        if (!matchGroups[b.scheduled_match_id]) {
          matchGroups[b.scheduled_match_id] = [];
        }
        matchGroups[b.scheduled_match_id].push(b);
      });
      
      console.log(`\nScheduled matches únicos: ${Object.keys(matchGroups).length}`);
      console.log("\n--- DETALLE POR BATALLA ---");
      
      debugBattles.forEach((b, idx) => {
        console.log(`\n[${idx + 1}] scheduled_match_id: ${b.scheduled_match_id}`);
        console.log(`    linked_battles en el match: ${b.linked_battles_count}`);
        console.log(`    battle_time (raw): ${b.battle_time_raw}`);
        console.log(`    dateKey calculado: ${b.dateKey}`);
        console.log(`    points_a: ${b.points_a}`);
      });
      
      // Mostrar duplicados si existen
      const duplicates = Object.entries(matchGroups).filter(([_, battles]) => battles.length > 1);
      if (duplicates.length > 0) {
        console.log("\n⚠️ SCHEDULED_MATCH_IDS DUPLICADOS:");
        duplicates.forEach(([matchId, battles]) => {
          console.log(`  ${matchId}: aparece ${battles.length} veces`);
        });
      }
    }

    // Detectar días sin jugar y aplicar penalizaciones
    // Sistema: -1 primer día, -2 segundo, -5 tercero, -10 cuarto en adelante
    // IMPORTANTE: Solo aplicar penalizaciones si el jugador NO jugó pero SÍ tenía un partido programado ese día
    
    // Primero, identificar qué días tienen partidos programados para cada jugador
    const playerScheduledDates = {};
    matches.forEach(match => {
      if (!match.linked_battles || match.linked_battles.length === 0 || !match.linked_battles[0].battle) {
        return;
      }
      
      const battleTime = match.linked_battles[0].battle.battle_time;
      if (!battleTime) return;
      
      const dateKey = getDateKey(battleTime);
      if (!dateKey) return;
      
      if (match.player_a_id) {
        if (!playerScheduledDates[match.player_a_id]) {
          playerScheduledDates[match.player_a_id] = new Set();
        }
        playerScheduledDates[match.player_a_id].add(dateKey);
      }
    });
    
    // Ahora aplicar penalizaciones solo a jugadores que tienen fechas programadas
    Object.keys(playerScheduledDates).forEach(playerId => {
      const player = players.find(p => p.player_id === playerId);
      if (!player) return;

      const scheduledDates = Array.from(playerScheduledDates[playerId]).sort();
      let consecutiveMissed = 0;

      scheduledDates.forEach((dateKey) => {
        // Verificar si el jugador estaba activo en esta fecha
        if (!isPlayerActiveOnDate(player, dateKey)) {
          return;
        }

        // Inicializar si no existe
        if (!playerDatePoints[playerId]) {
          playerDatePoints[playerId] = {};
        }
        
        const dayData = playerDatePoints[playerId][dateKey];
        
        if (!dayData || dayData.matches === 0) {
          // Día sin jugar (pero tenía partido programado)
          consecutiveMissed++;
          
          let penalty = 0;
          if (consecutiveMissed === 1) penalty = -1;
          else if (consecutiveMissed === 2) penalty = -2;
          else if (consecutiveMissed === 3) penalty = -5;
          else penalty = -10;

          playerDatePoints[playerId][dateKey] = { points: penalty, matches: 0 };
        } else {
          // Jugó, reiniciar contador
          consecutiveMissed = 0;
        }
      });
    });

    // Crear filas para la grilla
    const rows = players
      .filter(p => {
        // Filtro por nombre
        if (searchPlayer && !p.nickname.toLowerCase().includes(searchPlayer.toLowerCase())) {
          return false;
        }
        // Filtro por equipo
        if (filterTeamId && p.team?.team_id !== filterTeamId) {
          return false;
        }
        
        return true;
      })
      .map(player => {
        const datePoints = dates.map(dateKey => {
          const dayData = playerDatePoints[player.player_id]?.[dateKey];
          
          // Si el jugador no estaba activo, mostrar null
          if (!isPlayerActiveOnDate(player, dateKey)) {
            return null;
          }

          return dayData ? dayData.points : 0;
        });

        const total = datePoints.reduce((sum, p) => sum + (p || 0), 0);

        return {
          player_id: player.player_id,
          nickname: player.nickname,
          team: player.team?.name || "-",
          team_id: player.team?.team_id,
          team_logo: player.team?.logo,
          jersey_no: player.jersey_no || 99,
          datePoints,
          total,
        };
      })
      .sort((a, b) => {
        // Ordenar por equipo y luego por número de casaca
        if (a.team !== b.team) {
          return a.team.localeCompare(b.team);
        }
        return a.jersey_no - b.jersey_no;
      });

    return { dates, rows };
  }, [season, matches, players, searchPlayer, filterTeamId]);

  // Función para obtener color según puntos
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
      {/* Header */}
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
            <h1 className="text-slate-900 dark:text-white text-lg font-bold leading-tight">
              Resumen Diario de Puntos
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              {season?.description}
            </p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="w-full bg-white dark:bg-[#1c2333] border-b border-slate-200 dark:border-slate-800 px-5 py-4">
        <div className="flex flex-wrap gap-3">
          {/* Buscar jugador */}
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Buscar jugador..."
              value={searchPlayer}
              onChange={(e) => setSearchPlayer(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f1623] text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-[#1152d4] focus:ring-1 focus:ring-[#1152d4] transition-all"
            />
          </div>

          {/* Filtro equipo */}
          <div className="flex-1 min-w-[200px]">
            <select
              value={filterTeamId}
              onChange={(e) => setFilterTeamId(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f1623] text-slate-900 dark:text-white focus:border-[#1152d4] focus:ring-1 focus:ring-[#1152d4] transition-all"
            >
              <option value="">Todos los equipos</option>
              {teams.map(team => (
                <option key={team.team_id} value={team.team_id}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>


          {/* Filtro zonas */}
          <div className="flex-1 min-w-[200px]">
            <select
              value={filterZoneId}
              onChange={(e) => setFilterZoneId(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f1623] text-slate-900 dark:text-white focus:border-[#1152d4] focus:ring-1 focus:ring-[#1152d4] transition-all"
            >
              <option value="">Todas las zonas</option>
              {zones.map(zone => (
                <option key={zone.zone_id} value={zone.name}>
                  {zone.name}
                </option>
              ))}
            </select>
          </div>

          {/* Botón limpiar filtros */}
          {(searchPlayer || filterTeamId) && (
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

      {/* Grilla */}
      <div className="flex-1 w-full overflow-auto p-5">
        {gridData.rows.length === 0 ? (
          <div className="bg-white dark:bg-[#1c2333] rounded-xl border border-slate-200 dark:border-slate-800 p-8 text-center">
            <p className="text-slate-500 dark:text-slate-400">
              No hay datos para mostrar con los filtros aplicados.
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-[#1c2333] rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-[#0f1623] border-b border-slate-200 dark:border-slate-700">
                    <th className="sticky left-0 z-10 bg-slate-50 dark:bg-[#0f1623] px-4 py-3 text-left text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider border-r border-slate-200 dark:border-slate-700">
                      Jugador
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider border-r border-slate-200 dark:border-slate-700">
                      Equipo
                    </th>
                    {gridData.dates.map((dateKey, idx) => (
                      <th
                        key={idx}
                        className="px-2 py-3 text-center text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider border-r border-slate-200 dark:border-slate-700 min-w-[60px]"
                      >
                        {formatDate(dateKey)}
                      </th>
                    ))}
                    <th className="sticky right-0 z-10 bg-slate-50 dark:bg-[#0f1623] px-4 py-3 text-center text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider border-l-2 border-slate-300 dark:border-slate-600">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {gridData.rows.map((row, rowIdx) => (
                    <tr
                      key={row.player_id}
                      className={[
                        "border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors",
                        rowIdx % 2 === 0 ? "bg-white dark:bg-[#1c2333]" : "bg-slate-50/50 dark:bg-[#0f1623]/50"
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
                      {row.datePoints.map((points, idx) => (
                        <td
                          key={idx}
                          className={[
                            "px-2 py-2 text-center text-sm border-r border-slate-200 dark:border-slate-700",
                            getPointsColor(points)
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

      {/* Leyenda */}
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
            <span className="text-slate-600 dark:text-slate-400">Penalización: -1 (1er día), -2 (2do), -5 (3ro), -10 (4to+)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600"></div>
            <span className="text-slate-600 dark:text-slate-400">Jugador inactivo</span>
          </div>
        </div>
      </div>
    </div>
  );
}
