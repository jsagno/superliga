import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

export default function SeasonZoneRankings() {
  const navigate = useNavigate();
  const { seasonId, zoneId } = useParams();
  
  const [season, setSeason] = useState(null);
  const [zone, setZone] = useState(null);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const autoScrollIntervalRef = useRef(null);

  useEffect(() => {
    loadData();
    
    // Cleanup auto-scroll on unmount
    return () => {
      if (autoScrollIntervalRef.current) {
        clearInterval(autoScrollIntervalRef.current);
        autoScrollIntervalRef.current = null;
      }
    };
  }, [seasonId, zoneId]);

  async function loadData() {
    setLoading(true);

    try {
      // Load season info
      const { data: seasonData } = await supabase
        .from("season")
        .select("season_id, description")
        .eq("season_id", seasonId)
        .single();
      
      setSeason(seasonData);

      // Load zone info
      const { data: zoneData } = await supabase
        .from("season_zone")
        .select("zone_id, name")
        .eq("zone_id", zoneId)
        .single();
      
      setZone(zoneData);

      // Load players with their team assignments
      const { data: assignments } = await supabase
        .from("season_zone_team_player")
        .select(`
          season_zone_team_player_id,
          player_id,
          team_id,
          ranking_seed,
          player:player!inner (player_id, name, nick),
          team:team (team_id, name, logo)
        `)
        .eq("zone_id", zoneId)
        .order("ranking_seed", { ascending: true, nullsFirst: false });

      // Sort players: those with ranking_seed first, then those without
      const playersWithRanking = (assignments || []).filter(a => a.ranking_seed != null);
      const playersWithoutRanking = (assignments || []).filter(a => a.ranking_seed == null);
      
      // Sort with ranking by ranking_seed value
      playersWithRanking.sort((a, b) => a.ranking_seed - b.ranking_seed);
      
      // Combine: ranked first, then unranked
      const sortedPlayers = [...playersWithRanking, ...playersWithoutRanking];
      
      setPlayers(sortedPlayers);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  }

  async function saveRankings() {
    setSaving(true);

    try {
      // Update ranking_seed for each player based on current order
      const updates = players.map((player, index) => ({
        season_zone_team_player_id: player.season_zone_team_player_id,
        ranking_seed: index + 1
      }));

      // Batch update
      for (const update of updates) {
        await supabase
          .from("season_zone_team_player")
          .update({ ranking_seed: update.ranking_seed })
          .eq("season_zone_team_player_id", update.season_zone_team_player_id);
      }

      alert("Rankings actualizados correctamente");
      await loadData();
    } catch (error) {
      console.error("Error saving rankings:", error);
      alert("Error al guardar rankings");
    } finally {
      setSaving(false);
    }
  }

  function handleDragStart(e, index) {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/html", e.currentTarget);
    e.currentTarget.style.opacity = "0.4";
  }

  function handleDragEnd(e) {
    e.currentTarget.style.opacity = "1";
    setDraggedIndex(null);
    
    // Stop auto-scroll
    if (autoScrollIntervalRef.current) {
      clearInterval(autoScrollIntervalRef.current);
      autoScrollIntervalRef.current = null;
    }
    
    // Clean up all drag styling
    document.querySelectorAll('[data-draggable-item]').forEach(el => {
      el.style.borderTop = "";
    });
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    
    // Only auto-scroll if actively dragging
    if (draggedIndex === null) return;
    
    // Auto-scroll when near edges
    const scrollThreshold = 100; // pixels from edge to trigger scroll
    const scrollSpeed = 10; // pixels per interval
    const mouseY = e.clientY;
    const windowHeight = window.innerHeight;
    
    // Clear existing interval
    if (autoScrollIntervalRef.current) {
      clearInterval(autoScrollIntervalRef.current);
      autoScrollIntervalRef.current = null;
    }
    
    // Scroll up if near top
    if (mouseY < scrollThreshold) {
      autoScrollIntervalRef.current = setInterval(() => {
        window.scrollBy(0, -scrollSpeed);
      }, 16); // ~60fps
    }
    // Scroll down if near bottom
    else if (mouseY > windowHeight - scrollThreshold) {
      autoScrollIntervalRef.current = setInterval(() => {
        window.scrollBy(0, scrollSpeed);
      }, 16); // ~60fps
    }
  }

  function handleDrop(e, dropIndex) {
    e.preventDefault();
    
    // Clean up drag styling
    e.currentTarget.style.backgroundColor = "";
    e.currentTarget.style.borderBottom = "";
    e.currentTarget.style.borderTop = "";
    
    if (draggedIndex === null) return;

    const newPlayers = [...players];
    const draggedPlayer = newPlayers[draggedIndex];
    
    // Remove from old position
    newPlayers.splice(draggedIndex, 1);
    
    // Adjust drop index if dragging from before the drop position
    const adjustedDropIndex = draggedIndex < dropIndex ? dropIndex - 1 : dropIndex;
    
    // Insert at new position
    newPlayers.splice(adjustedDropIndex, 0, draggedPlayer);
    
    setPlayers(newPlayers);
  }

  function handleDragEnter(e, index) {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      e.currentTarget.style.borderTop = "3px solid #3b82f6";
    }
  }

  function handleDragLeave(e) {
    e.currentTarget.style.borderTop = "";
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-white/60">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="p-6 mx-auto max-w-5xl">
      {/* Header */}
      <div className="mb-6 flex items-start gap-4">
        <button
          onClick={() => navigate(`/admin/seasons/${seasonId}/zones`)}
          className="h-10 w-10 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>

        <div className="flex-1">
          <h1 className="text-2xl font-semibold">Rankings de Jugadores</h1>
          <p className="mt-1 text-sm text-white/60">
            {season?.description} - {zone?.name}
          </p>
        </div>

        <button
          onClick={saveRankings}
          disabled={saving || players.length === 0}
          className="rounded-xl px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 transition font-semibold text-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "Guardando..." : "Guardar Rankings"}
        </button>
      </div>

      {/* Instructions */}
      <div className="mb-6 rounded-2xl bg-blue-500/10 border border-blue-500/20 p-4">
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined text-blue-200 mt-0.5">info</span>
          <div className="text-sm text-blue-200">
            <div className="font-semibold mb-1">Instrucciones</div>
            <div className="text-blue-200/80">
              Arrastra y suelta los jugadores para cambiar su posición en el ranking. 
              El jugador en la posición 1 tiene el ranking más alto. 
              Haz clic en "Guardar Rankings" para aplicar los cambios.
            </div>
          </div>
        </div>
      </div>

      {/* Rankings Table */}
      {players.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-white/60">
          No hay jugadores asignados a esta zona
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
          <div className="border-b border-white/10 px-4 py-3">
            <div className="text-sm font-semibold">
              {players.length} jugadores
            </div>
          </div>

          <div className="divide-y divide-white/10">
            {/* Drop zone at the top */}
            <div
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, 0)}
              onDragEnter={(e) => {
                e.preventDefault();
                if (draggedIndex !== null && draggedIndex !== 0) {
                  e.currentTarget.style.backgroundColor = "rgba(59, 130, 246, 0.1)";
                  e.currentTarget.style.borderBottom = "3px solid #3b82f6";
                }
              }}
              onDragLeave={(e) => {
                e.currentTarget.style.backgroundColor = "";
                e.currentTarget.style.borderBottom = "";
              }}
              className="h-8 flex items-center justify-center transition-colors"
              style={{ minHeight: "32px" }}
            >
              <div className="text-xs text-white/30">Arrastra aquí para mover al primer lugar</div>
            </div>

            {players.map((player, index) => (
              <div
                key={player.season_zone_team_player_id}
                data-draggable-item
                draggable={true}
                onDragStart={(e) => handleDragStart(e, index)}
                onDragEnd={handleDragEnd}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnter={(e) => handleDragEnter(e, index)}
                onDragLeave={handleDragLeave}
                className="flex items-center gap-4 px-4 py-4 hover:bg-white/5 transition cursor-move group select-none"
              >
                {/* Drag Handle */}
                <div className="flex-shrink-0">
                  <span className="material-symbols-outlined text-white/40 group-hover:text-white/60">
                    drag_indicator
                  </span>
                </div>

                {/* Rank Badge */}
                <div 
                  className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center font-bold text-xl"
                  style={{
                    background: index === 0 
                      ? 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)'
                      : index === 1
                      ? 'linear-gradient(135deg, #94a3b8 0%, #64748b 100%)'
                      : index === 2
                      ? 'linear-gradient(135deg, #d97706 0%, #b45309 100%)'
                      : 'rgba(51, 65, 85, 0.8)',
                    color: index < 3 ? '#ffffff' : '#94a3b8',
                    boxShadow: index === 0 ? '0 4px 12px rgba(251, 191, 36, 0.4)' : 'none'
                  }}
                >
                  {index + 1}
                </div>

                {/* Team Logo */}
                {player.team?.logo ? (
                  <div className="flex-shrink-0 w-12 h-12 rounded-full overflow-hidden border-2 border-white/10">
                    <img 
                      src={player.team.logo} 
                      alt={player.team.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center bg-white/5 border-2 border-white/10">
                    <span className="material-symbols-outlined text-white/40">shield</span>
                  </div>
                )}

                {/* Player Info */}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-lg">
                    {player.player?.nick || player.player?.name || "Sin nombre"}
                  </div>
                  <div className="text-sm text-white/60">
                    {player.team?.name || "Sin equipo"}
                  </div>
                </div>

                {/* Current Ranking Badge */}
                {player.ranking_seed && (
                  <div className="flex-shrink-0 px-3 py-1 rounded-lg bg-white/5 border border-white/10">
                    <div className="text-xs text-white/60">Ranking actual</div>
                    <div className="text-lg font-bold text-center">{player.ranking_seed}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info Footer */}
      {players.length > 0 && (
        <div className="mt-4 text-xs text-white/60 text-center">
          Los cambios no se guardarán hasta que hagas clic en "Guardar Rankings"
        </div>
      )}
    </div>
  );
}
