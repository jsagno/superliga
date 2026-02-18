import { useEffect, useMemo, useState, useRef } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useNavigate, useParams, useLocation } from "react-router-dom";

export default function SeasonAssignments() {
  const navigate = useNavigate();
  const { seasonId: seasonParam } = useParams();
  const location = useLocation();
  const scrollContainerRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [seasons, setSeasons] = useState([]);
  const [seasonId, setSeasonId] = useState("");

  const [zones, setZones] = useState([]);
  const [zoneId, setZoneId] = useState("");

  const [teams, setTeams] = useState([]);
  const [players, setPlayers] = useState([]); // all players
  const [assignments, setAssignments] = useState([]); // season_zone_team_player rows

  const [q, setQ] = useState("");
  const [contextMenu, setContextMenu] = useState(null); // { x, y, playerId }

  const assignedIds = useMemo(() => {
    return new Set(assignments.map((r) => r.player_id));
  }, [assignments]);

  const availablePlayers = useMemo(() => {
    return players.filter((p) => !assignedIds.has(p.player_id));
  }, [players, assignedIds]);

  // misma lógica que PlayersList.jsx
  const filteredAvailable = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return availablePlayers;
    return availablePlayers.filter((p) => {
      const a = (p.name ?? "").toLowerCase();
      const b = (p.nick ?? "").toLowerCase();
      const c = (p.current_tag ?? "").toLowerCase();
      return a.includes(s) || b.includes(s) || c.includes(s);
    });
  }, [availablePlayers, q]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const { data: s } = await supabase.from("season").select("season_id,description").order("created_at", { ascending: false });
        setSeasons(s || []);
        // prefer season provided by route param or navigation state, else fallback to first
        if (location?.state?.season && location.state.season.season_id) {
          setSeasonId(location.state.season.season_id);
        } else if (seasonParam) {
          setSeasonId(seasonParam);
        } else if (s && s.length) {
          setSeasonId((prev) => prev || s[0].season_id);
        }
      } catch (e) {
        console.error(e);
        alert("Error loading seasons");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!seasonId) return;
    (async () => {
      try {
        setLoading(true);
        const { data: z } = await supabase.from("season_zone").select("zone_id,name,zone_order").eq("season_id", seasonId).order("zone_order");
        setZones(z || []);
        if (z && z.length) setZoneId((prev) => prev || z[0].zone_id);
      } catch (e) {
        console.error(e);
        alert("Error loading zones");
      } finally {
        setLoading(false);
      }
    })();
  }, [seasonId]);


  useEffect(() => {
    if (!zoneId) return;
    loadTeamsAndPlayers(zoneId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoneId]);

  async function loadTeamsAndPlayers(zone_id) {
    try {
      setLoading(true);
      // season_zone_team contains team_id references; fetch those rows first
      const { data: szt } = await supabase.from("season_zone_team").select("season_zone_team_id,team_id,team_order").eq("zone_id", zone_id).order("team_order", { ascending: true });
      const sztRows = szt || [];      

      // fetch team details for the referenced team_ids
      const teamIds = Array.from(new Set(sztRows.map((r) => r.team_id).filter(Boolean)));
      let teamsWithInfo = sztRows;
      if (teamIds.length) {
        const { data: teamInfos } = await supabase.from("team").select("team_id,name,logo").in("team_id", teamIds);
        teamsWithInfo = sztRows.map((r) => ({
          ...r,
          name: teamInfos?.find((t) => t.team_id === r.team_id)?.name || r.team_id,
          logo: teamInfos?.find((t) => t.team_id === r.team_id)?.logo || null,
        }));
      }
      setTeams(teamsWithInfo || []);
      var zonePlayersToExclude = zones.filter((z) => z.zone_id !== zone_id);
      const {data: szp} = await supabase.from("season_zone_team_player").select("player_id").in("zone_id", zonePlayersToExclude.map((z) => z.zone_id));
      const playerIdsToExclude = szp?.map((r) => r.player_id) || [];
      // all players 
      const { data: pData, error: pErr } = await supabase
        .from("player")
        .select("player_id,name,nick,created_at")
        .notIn("player_id", playerIdsToExclude) // exclude teams
        .order("created_at", { ascending: false });

      if (pErr) throw pErr;

      const ids = (pData ?? []).map((x) => x.player_id);
      let tagMap = new Map();

      if (ids.length) {
        const { data: tData, error: tErr } = await supabase
          .from("v_player_current_tag")
          .select("player_id,player_tag")
          .in("player_id", ids);

        if (!tErr) {
          for (const r of tData ?? []) tagMap.set(r.player_id, r.player_tag);
        }
      }

      const mergedPlayers = (pData ?? []).map((p) => ({
        ...p,
        current_tag: tagMap.get(p.player_id) ?? "",
      }));

      setPlayers(mergedPlayers);      

      // assignments
      const { data: a } = await supabase.from("season_zone_team_player").select("season_zone_team_player_id,zone_id,team_id,player_id,jersey_no,is_captain,start_date,end_date").eq("zone_id", zone_id);
      setAssignments(a || []);
    } catch (e) {
      console.error(e);
      alert("Error loading teams/players/assignments");
    } finally {
      setLoading(false);
    }
  }

  function getAssignedPlayerIds() {
    return new Set(assignments.map((r) => r.player_id));
  }

  function playersForTeam(teamId) {
    return assignments
      .filter((a) => a.team_id === teamId)
      .sort((a, b) => {
        // Sort by jersey number ascending
        const aJersey = a.jersey_no || 99;
        const bJersey = b.jersey_no || 99;
        return aJersey - bJersey;
      })
      .map((a) => ({ 
        ...a, 
        player: players.find((p) => p.player_id === a.player_id),
        isActive: !a.end_date || new Date(a.end_date) >= new Date()
      }));
  }

  async function handleDropOnTeam(e, teamId) {
    e.preventDefault();
    const pid = e.dataTransfer.getData("text/player_id");
    if (!pid) return;
    try {
      setLoading(true);
      // prevent assigning a player twice in the same zone
      if (getAssignedPlayerIds().has(pid)) {
        alert("El jugador ya está asignado en esta zona");
        return;
      }

      // compute next available jersey_no (1..8) from active players
      const teamAssignments = assignments.filter((a) => a.team_id === teamId);
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Reset time to start of day for accurate comparison
      const activeAssignments = teamAssignments.filter((a) => {
        if (!a.end_date) return true; // No end date = active
        const endDate = new Date(a.end_date);
        endDate.setHours(0, 0, 0, 0);
        return endDate >= today; // End date is today or future = active
      });
      
      console.log('Team assignments:', teamAssignments.length);
      console.log('Active assignments:', activeAssignments.length);
      console.log('Active players:', activeAssignments.map(a => ({ id: a.player_id, jersey: a.jersey_no, end: a.end_date })));
      
      if (activeAssignments.length >= 8) {
        alert("El equipo ya tiene 8 jugadores activos");
        return;
      }
      
      // Find unused jersey numbers among active players
      const usedJerseys = new Set(activeAssignments.map((a) => a.jersey_no).filter(Boolean));
      console.log('Used jerseys by active players:', Array.from(usedJerseys));
      
      let jersey_no = null;
      for (let i = 1; i <= 8; i++) {
        if (!usedJerseys.has(i)) {
          jersey_no = i;
          break;
        }
      }
      
      if (!jersey_no) {
        alert(`Todos los números de camiseta (1-8) están en uso por jugadores activos. Activos: ${activeAssignments.length}, Jerseys usados: ${Array.from(usedJerseys).join(', ')}`);
        return;
      }

      const is_captain = jersey_no === 1;
      const league = "A"; // default league; adjust as needed
      const ranking_seed = jersey_no; // simple default mapping
      const start_date = new Date().toISOString().split('T')[0]; // today as YYYY-MM-DD

      const { error } = await supabase.from("season_zone_team_player").insert({ zone_id: zoneId, team_id: teamId, player_id: pid, jersey_no, is_captain, league, ranking_seed, start_date });
      if (error) throw error;
      await loadTeamsAndPlayers(zoneId);
    } catch (err) {
      console.error(err);
      alert("Error assigning player");
    } finally {
      setLoading(false);
    }
  }

  async function handleDropUnassigned(e) {
    e.preventDefault();
    const pid = e.dataTransfer.getData("text/player_id");
    if (!pid) return;
    try {
      setLoading(true);
      // remove any assignment for this zone/team/player
      const { error } = await supabase.from("season_zone_team_player").delete().eq("zone_id", zoneId).eq("player_id", pid);
      if (error) throw error;
      await loadTeamsAndPlayers(zoneId);
    } catch (err) {
      console.error(err);
      alert("Error removing assignment");
    } finally {
      setLoading(false);
    }
  }

  function handlePlayerContextMenu(e, playerId) {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, playerId });
  }

  function closeContextMenu() {
    setContextMenu(null);
  }

  async function assignPlayerFromContextMenu(teamId) {
    if (!contextMenu) return;
    const pid = contextMenu.playerId;
    closeContextMenu();

    try {
      setLoading(true);
      if (getAssignedPlayerIds().has(pid)) {
        alert("El jugador ya está asignado en esta zona");
        return;
      }

      const teamAssignments = assignments.filter((a) => a.team_id === teamId);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const activeAssignments = teamAssignments.filter((a) => {
        if (!a.end_date) return true;
        const endDate = new Date(a.end_date);
        endDate.setHours(0, 0, 0, 0);
        return endDate >= today;
      });
      
      if (activeAssignments.length >= 8) {
        alert("El equipo ya tiene 8 jugadores activos");
        return;
      }
      
      // Find unused jersey numbers among ACTIVE players only
      const usedJerseys = new Set(activeAssignments.map((a) => a.jersey_no).filter(Boolean));
      let jersey_no = null;
      for (let i = 1; i <= 8; i++) {
        if (!usedJerseys.has(i)) {
          jersey_no = i;
          break;
        }
      }
      
      if (!jersey_no) {
        alert(`Todos los números de camiseta (1-8) están en uso por jugadores activos. Activos: ${activeAssignments.length}`);
        return;
      }

      const is_captain = jersey_no === 1;
      const league = "A";
      const ranking_seed = jersey_no;
      const start_date = new Date().toISOString().split('T')[0]; // today as YYYY-MM-DD

      const { error } = await supabase.from("season_zone_team_player").insert({ zone_id: zoneId, team_id: teamId, player_id: pid, jersey_no, is_captain, league, ranking_seed, start_date });
      if (error) throw error;
      await loadTeamsAndPlayers(zoneId);
    } catch (err) {
      console.error(err);
      alert("Error assigning player");
    } finally {
      setLoading(false);
    }
  }

  function onDragStart(e, playerId) {
    e.dataTransfer.setData("text/player_id", playerId);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOverScroll(e) {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const rect = container.getBoundingClientRect();
    const scrollThreshold = 100;
    const scrollSpeed = 10;

    // If cursor is near top, scroll up
    if (e.clientY - rect.top < scrollThreshold) {
      container.scrollTop -= scrollSpeed;
    }
    // If cursor is near bottom, scroll down
    else if (rect.bottom - e.clientY < scrollThreshold) {
      container.scrollTop += scrollSpeed;
    }
  }

  async function updateAssignmentJersey(assignmentId, teamId, newJersey) {
    if (!assignmentId) return;
    const jerseyNo = Number(newJersey);
    if (!Number.isInteger(jerseyNo) || jerseyNo < 1 || jerseyNo > 8) {
      alert("Número de casaca inválido (1-8)");
      await loadTeamsAndPlayers(zoneId);
      return;
    }

    // local conflict check
    const conflict = assignments.find((a) => a.team_id === teamId && a.jersey_no === jerseyNo && a.season_zone_team_player_id !== assignmentId);
    if (conflict) {
      alert("Ese número ya está usado en el equipo");
      await loadTeamsAndPlayers(zoneId);
      return;
    }

    try {
      setLoading(true);
      const is_captain = jerseyNo === 1;
      const { error } = await supabase.from("season_zone_team_player").update({ jersey_no: jerseyNo, is_captain }).eq("season_zone_team_player_id", assignmentId);
      if (error) throw error;
      await loadTeamsAndPlayers(zoneId);
    } catch (err) {
      console.error(err);
      alert("Error actualizando número de casaca (puede estar en uso)");
      await loadTeamsAndPlayers(zoneId);
    } finally {
      setLoading(false);
    }
  }

  async function updateAssignmentDates(assignmentId, teamId) {
    if (!assignmentId) return;
    const assignment = assignments.find((a) => a.season_zone_team_player_id === assignmentId);
    if (!assignment) return;

    const { start_date, end_date } = assignment;

    // Validate dates
    if (start_date && end_date && new Date(end_date) < new Date(start_date)) {
      alert("La fecha de fin debe ser posterior a la fecha de inicio");
      await loadTeamsAndPlayers(zoneId);
      return;
    }

    // Check if this would create more than 8 active players at any point
    if (!end_date) {
      // Player is being set as active, check current active count
      const activeCount = assignments.filter((a) => 
        a.team_id === teamId && 
        a.season_zone_team_player_id !== assignmentId &&
        (!a.end_date || new Date(a.end_date) >= new Date())
      ).length;

      if (activeCount >= 8) {
        alert("No puede haber más de 8 jugadores activos simultáneamente en un equipo");
        await loadTeamsAndPlayers(zoneId);
        return;
      }
    }

    try {
      setLoading(true);
      const { error } = await supabase
        .from("season_zone_team_player")
        .update({ start_date, end_date })
        .eq("season_zone_team_player_id", assignmentId);
      if (error) throw error;
      await loadTeamsAndPlayers(zoneId);
    } catch (err) {
      console.error(err);
      alert("Error actualizando fechas");
      await loadTeamsAndPlayers(zoneId);
    } finally {
      setLoading(false);
    }
  }

  async function removeAssignment(assignmentId) {
    if (!assignmentId) return;
    if (!confirm("Quitar jugador del equipo?")) return;
    try {
      setLoading(true);
      const { error } = await supabase.from("season_zone_team_player").delete().eq("season_zone_team_player_id", assignmentId);
      if (error) throw error;
      await loadTeamsAndPlayers(zoneId);
    } catch (err) {
      console.error(err);
      alert("Error removiendo asignación");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div ref={scrollContainerRef} className="min-h-screen bg-background-light dark:bg-background-dark text-slate-900 dark:text-white font-display p-4 overflow-y-auto" onDragOver={handleDragOverScroll}>
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate(-1)} className="h-10 w-10 rounded-full bg-white/5 grid place-items-center">←</button>
          <h1 className="text-lg font-bold">Asignar Jugadores a Equipos</h1>
          <div className="ml-auto flex items-center gap-2">
            <select value={seasonId} onChange={(e) => setSeasonId(e.target.value)} className="rounded-md bg-[#0B1220] px-3 py-2">
              <option value="" disabled>Seleccionar temporada</option>
              {seasons.map((s) => <option key={s.season_id} value={s.season_id}>{s.description || s.season_id}</option>)}
            </select>
            <select value={zoneId} onChange={(e) => setZoneId(e.target.value)} className="rounded-md bg-[#0B1220] px-3 py-2">
              <option value="" disabled>Seleccionar zona</option>
              {zones.map((z) => <option key={z.zone_id} value={z.zone_id}>{z.name}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-1">
            <div className="rounded-xl bg-white/5 p-4" onDragOver={(e)=>e.preventDefault()} onDrop={handleDropUnassigned}>
              <div className="text-sm font-semibold mb-2">Jugadores disponibles</div>
              
              <div className="mb-3">
                <label className="flex flex-col h-10 w-full">
                  <div className="flex w-full items-stretch rounded-xl h-full overflow-hidden">
                    <div className="text-gray-400 flex items-center justify-center pl-3 pr-2">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M12.9 14.32a8 8 0 111.414-1.414l4.387 4.387a1 1 0 01-1.414 1.414l-4.387-4.387zM8 14a6 6 0 100-12 6 6 0 000 12z" clipRule="evenodd"/>
                      </svg>
                    </div>
                    <input
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="Buscar por nick o tag (#...)"
                      className="flex-1 min-w-0 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 outline-none focus:border-blue-600"
                    />
                  </div>
                </label>
              </div>
              
              <div className="space-y-2">
                {filteredAvailable.map(p => (
                  <div key={p.player_id} draggable onDragStart={(e)=>onDragStart(e,p.player_id)} onContextMenu={(e)=>handlePlayerContextMenu(e,p.player_id)} className="flex items-center gap-3 p-2 rounded bg-white/5 cursor-grab">
                    <img src={p.photo || p.avatar || '/src/assets/unnamed.png'} alt="avatar" className="w-10 h-10 rounded-full object-cover" />
                    <div className="flex-1">
                      <div className="font-medium">{p.nick || p.name || p.player_id}</div>
                      <div className="text-xs text-white/60">Jugador</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="col-span-2">
            <div className="space-y-4">
              {teams.map(team => (
                <div key={team.team_id} className="rounded-xl bg-white/5 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="font-semibold">{team.name}</div>
                      <div className="text-xs text-white/70">Equipo</div>
                    </div>
                    <div className="px-2 py-1 rounded bg-white/5">
                      {playersForTeam(team.team_id).filter(a => a.isActive).length} / {playersForTeam(team.team_id).length} activos
                    </div>
                  </div>

                  <div className="min-h-[64px] p-2 rounded bg-transparent" onDragOver={(e)=>e.preventDefault()} onDrop={(e)=>handleDropOnTeam(e, team.team_id)}>
                    {playersForTeam(team.team_id).map(a => (
                      <div 
                        key={a.player_id} 
                        draggable 
                        onDragStart={(e)=>onDragStart(e,a.player_id)} 
                        className={`flex items-center gap-3 p-2 mb-2 rounded ${a.isActive ? 'bg-white/10' : 'bg-white/5 opacity-60'}`}
                      >
                        <img src={a.player?.photo || a.player?.avatar || '/src/assets/unnamed.png'} alt="avatar" className="w-10 h-10 rounded-full object-cover" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <div className="font-medium">{a.player?.nick || a.player?.name || a.player_id}</div>
                            {a.is_captain ? (
                              <div className="text-xs px-2 py-0.5 bg-blue-600 text-white rounded flex items-center gap-1">🏆 <span>Capitán</span></div>
                            ) : (
                              <div className="text-xs text-white/70">Jugador</div>
                            )}
                            {!a.isActive && <span className="text-xs text-red-400">(Inactivo)</span>}
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 flex-1">
                          <div className="flex items-center gap-2">
                            <div className="w-20">
                              <input
                                type="number"
                                min={1}
                                max={8}
                                value={a.jersey_no || ''}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setAssignments((prev) => prev.map((it) => it.season_zone_team_player_id === a.season_zone_team_player_id ? { ...it, jersey_no: v ? Number(v) : null } : it));
                                }}
                                onBlur={(e) => updateAssignmentJersey(a.season_zone_team_player_id, a.team_id, e.target.value)}
                                className="w-full rounded bg-white/5 text-center px-2 py-1"
                              />
                            </div>
                            <button onClick={() => removeAssignment(a.season_zone_team_player_id)} className="w-8 h-8 grid place-items-center rounded-full bg-white/5 hover:bg-red-600 text-white/90">
                              ✕
                            </button>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <div className="flex items-center gap-1">
                              <span className="text-white/60">Desde:</span>
                              <input
                                type="date"
                                value={a.start_date || ''}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setAssignments((prev) => prev.map((it) => it.season_zone_team_player_id === a.season_zone_team_player_id ? { ...it, start_date: v || null } : it));
                                }}
                                onBlur={() => updateAssignmentDates(a.season_zone_team_player_id, a.team_id)}
                                className="rounded bg-white/5 px-2 py-1"
                              />
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-white/60">Hasta:</span>
                              <input
                                type="date"
                                value={a.end_date || ''}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setAssignments((prev) => prev.map((it) => it.season_zone_team_player_id === a.season_zone_team_player_id ? { ...it, end_date: v || null } : it));
                                }}
                                onBlur={() => updateAssignmentDates(a.season_zone_team_player_id, a.team_id)}
                                className="rounded bg-white/5 px-2 py-1"
                              />
                            </div>
                            {!a.end_date && <span className="text-green-400">●</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {contextMenu && (
          <div onClick={closeContextMenu} className="fixed inset-0 z-40" />
        )}

        {contextMenu && (
          <div
            style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
            className="fixed z-50 bg-slate-900 border border-slate-700 rounded-lg shadow-lg overflow-hidden"
          >
            {teams.map(team => (
              <button
                key={team.team_id}
                onClick={() => assignPlayerFromContextMenu(team.team_id)}
                className="w-full text-left px-4 py-2 hover:bg-blue-600 text-white transition-colors"
              >
                {team.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}