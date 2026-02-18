import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useNavigate } from "react-router-dom";

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function fmtDate(dt) {
  if (!dt) return "—";
  try {
    const d = new Date(dt);
    return d.toLocaleString();
  } catch {
    return String(dt);
  }
}

export default function SeasonZones() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [seasons, setSeasons] = useState([]);
  const [seasonId, setSeasonId] = useState("");

  const [zones, setZones] = useState([]);

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null); // season_zone row or null

  const [form, setForm] = useState({
    name: "",
    zone_order: 1,
  });

  const zonesCount = zones?.length ?? 0;

  const selectedSeason = useMemo(() => {
    return seasons.find((s) => s.season_id === seasonId) || null;
  }, [seasons, seasonId]);

  async function loadSeasons() {
    // Campos “seguros” según lo que venimos usando
    // (si tenés otros, los podés sumar)
    const { data, error } = await supabase
      .from("season")
      .select("season_id, description, duel_start_date, ladder_start_date, created_at")
      .order("created_at", { ascending: false });

    if (error) throw error;

    setSeasons(data || []);
    // Elegir default si no hay
    if (!seasonId && data && data.length > 0) {
      setSeasonId(data[0].season_id);
    }
  }

  async function loadZones(season_id) {
    if (!season_id) {
      setZones([]);
      return;
    }

    // 1) load zones
    const { data: zonesData, error: zonesErr } = await supabase
      .from("season_zone")
      .select("zone_id, season_id, name, zone_order, is_dirty_points, is_dirty_standings, last_snapshot_at, created_at")
      .eq("season_id", season_id)
      .order("zone_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (zonesErr) throw zonesErr;
    const zonesList = zonesData || [];

    // 2) fetch assigned teams for these zones to compute per-zone team counts
    const zoneIds = zonesList.map((z) => z.zone_id).filter(Boolean);
    let teamCounts = {};
    let playerCounts = {};
    if (zoneIds.length > 0) {
      try {
        const { data: assignedTeamsData, error: atErr } = await supabase
          .from("season_zone_team")
          .select("zone_id,team_id")
          .in("zone_id", zoneIds);
        if (!atErr && Array.isArray(assignedTeamsData)) {
          // count distinct team_ids per zone
          const perZoneTeams = {};
          for (const r of assignedTeamsData) {
            const z = r.zone_id;
            if (!perZoneTeams[z]) perZoneTeams[z] = new Set();
            if (r.team_id) perZoneTeams[z].add(r.team_id);
          }
          for (const [k, s] of Object.entries(perZoneTeams)) teamCounts[k] = s.size;
          // debug
          // eslint-disable-next-line no-console
          console.debug("season_zone_team fetched", { assignedTeamsDataLength: assignedTeamsData.length, teamCounts });
        } else {
          // eslint-disable-next-line no-console
          console.debug("no assignedTeamsData or error", { atErr, assignedTeamsData });
        }
      } catch (e) {
        // non-fatal
        // eslint-disable-next-line no-console
        console.error("failed fetching season_zone_team for counts:", e);
      }

      try {
        const { data: assignedPlayersData, error: apErr } = await supabase
          .from("season_zone_team_player")
          .select("zone_id,player_id")
          .in("zone_id", zoneIds);
        if (!apErr && Array.isArray(assignedPlayersData)) {
          // count distinct players per zone
          const perZone = {};
          for (const r of assignedPlayersData) {
            const z = r.zone_id;
            perZone[z] = perZone[z] || new Set();
            if (r.player_id) perZone[z].add(r.player_id);
          }
          for (const [k, s] of Object.entries(perZone)) playerCounts[k] = s.size;
        }
      } catch (e) {
        // non-fatal
        // eslint-disable-next-line no-console
        console.error("failed fetching season_zone_team_player for counts:", e);
      }
    }

    // merge counts into zones
    const enriched = zonesList.map((z) => ({
      ...z,
      team_count: teamCounts[z.zone_id] || 0,
      player_count: playerCounts[z.zone_id] || 0,
    }));

    setZones(enriched);
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        await loadSeasons();
      } catch (e) {
        console.error(e);
        alert(`Error loading seasons: ${e.message || e}`);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        await loadZones(seasonId);
      } catch (e) {
        console.error(e);
        alert(`Error loading zones: ${e.message || e}`);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [seasonId]);

  function openCreate() {
    setEditing(null);
    setForm({
      name: "",
      zone_order: Math.max(1, (zones?.[zones.length - 1]?.zone_order || zones.length || 0) + 1),
    });
    setModalOpen(true);
  }

  function openEdit(z) {
    setEditing(z);
    setForm({
      name: z?.name || "",
      zone_order: Number.isFinite(z?.zone_order) ? z.zone_order : 1,
    });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
  }

  async function saveZone(e) {
    e?.preventDefault?.();
    if (!seasonId) return alert("Seleccioná una temporada.");
    if (!form.name.trim()) return alert("El nombre es obligatorio.");

    try {
      setSaving(true);

      const payload = {
        season_id: seasonId,
        name: form.name.trim(),
        zone_order: parseInt(String(form.zone_order || 1), 10) || 1,
      };

      if (!editing) {
        const { error } = await supabase.from("season_zone").insert(payload);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("season_zone")
          .update(payload)
          .eq("zone_id", editing.zone_id);
        if (error) throw error;
      }

      await loadZones(seasonId);
      closeModal();
    } catch (e2) {
      console.error(e2);
      alert(`Error saving zone: ${e2.message || e2}`);
    } finally {
      setSaving(false);
    }
  }

  async function deleteZone(z) {
    if (!z?.zone_id) return;
    const ok = confirm(
      `Eliminar zona "${z.name}"?\n\nEsto puede fallar si hay registros relacionados (FK).`
    );
    if (!ok) return;

    try {
      setSaving(true);
      const { error } = await supabase.from("season_zone").delete().eq("zone_id", z.zone_id);
      if (error) throw error;
      await loadZones(seasonId);
    } catch (e) {
      console.error(e);
      alert(`Error deleting zone: ${e.message || e}`);
    } finally {
      setSaving(false);
    }
  }

  function renderModal() {
    if (!modalOpen) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
        <div
          className="absolute inset-0 bg-black/60"
          onClick={closeModal}
          role="button"
          tabIndex={-1}
        />
        <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#070B14] shadow-[0_20px_80px_rgba(0,0,0,.6)] overflow-hidden">
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <div className="font-semibold">{editing ? "Editar Zona" : "Nueva Zona"}</div>
            <button
              type="button"
              onClick={closeModal}
              className="h-9 w-9 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 grid place-items-center"
              title="Cerrar"
            >
              ✕
            </button>
          </div>

          <form className="p-4 space-y-4" onSubmit={saveZone}>
            <div>
              <label className="text-sm text-white/70">Nombre</label>
              <input
                className="mt-1 w-full rounded-xl bg-[#0B1220] border border-white/10 px-3 py-3 outline-none focus:ring-2 focus:ring-[#1B4DFF]/60"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ej: Zona Élite"
              />
            </div>

            <div>
              <label className="text-sm text-white/70">Orden</label>
              <input
                type="number"
                className="mt-1 w-full rounded-xl bg-[#0B1220] border border-white/10 px-3 py-3 outline-none focus:ring-2 focus:ring-[#1B4DFF]/60"
                value={form.zone_order}
                onChange={(e) => setForm((f) => ({ ...f, zone_order: e.target.value }))}
                min={1}
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={closeModal}
                className="h-12 flex-1 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 font-semibold"
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className={cx(
                  "h-12 flex-1 rounded-xl font-semibold shadow",
                  "bg-[#1B4DFF] hover:bg-[#1843db]",
                  saving ? "opacity-70 cursor-not-allowed" : ""
                )}
                disabled={saving}
              >
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>

            <div className="text-xs text-white/50">
              * Los flags <b>is_dirty_points</b> / <b>is_dirty_standings</b> se manejan automáticamente por el job de puntos/standings (no desde esta pantalla).
            </div>
          </form>
        </div>
      </div>
    );
  }

  function renderZones() {
    if (loading) {
      return (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-slate-700">Cargando...</div>
      );
    }
    if (zonesCount === 0) {
      return (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-slate-700">No hay zonas para esta temporada. Creá una con <b>+ Nueva Zona</b>.</div>
      );
    }

    return (
      <div className="grid grid-cols-1 gap-4">
        {zones.map((z) => (
          <div key={z.zone_id} className="flex flex-col rounded-xl bg-[#0B2440] text-white shadow-sm border border-slate-800 overflow-hidden">
            <div className="flex items-stretch gap-4 p-4">
              <div className="flex flex-1 flex-col gap-1">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-lg font-bold">{z.name}</h4>
                    <p className="text-text-secondary text-xs font-medium uppercase tracking-wide mt-1 text-white/70">Nivel {z.zone_order ?? ''}</p>
                  </div>
                  <button type="button" onClick={() => openEdit(z)} className="text-white/70 hover:text-white p-1 -mr-2 -mt-2 rounded-full bg-transparent">
                    <span className="material-symbols-outlined">more_vert</span>
                  </button>
                </div>

                <div className="flex items-center gap-3 mt-3">
                  <div className="flex items-center gap-1.5 text-sm text-white/80 bg-white/5 px-2 py-1 rounded">
                    <span className="material-symbols-outlined text-[16px] text-primary">groups</span>
                    <span className="font-medium">{(z.team_count ?? 0)} Equipos</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-white/80 bg-white/5 px-2 py-1 rounded">
                    <span className="material-symbols-outlined text-[16px] text-purple-300">person</span>
                    <span className="font-medium">{(z.player_count ?? 0)} Jugadores</span>
                  </div>
                </div>
              </div>
              <div className="w-20 h-20 rounded-lg shrink-0 border border-slate-800 overflow-hidden bg-white/5 grid place-items-center">
                <img src={z.logo_url || 'https://lh3.googleusercontent.com/aida-public/AB6AXuDLEpJYy_Ajvxia3_0lwsHxwNQjzycOWDBy1eOpCu3Qv9KS82PvcU6TUoGdm9qv7g-x9mutlICt7agTD8JUQgDWskJ7Hdf1a1nNUTCfhmk9g7STWX8kp4ui0Wnk8KqL5elG0jTAN7Po6MZJC1nydHXDUDZ5xJ0E0Hc6BpNo4eu-l00t7kNCtyWr9QfvYD58hheLo86mE8Uge4mAd0jKWf2OdtYSZoyPTPwy8ON0oIZ2Ytjwroxlfz4aFH6cxnjYiscNkzcp5Gl0SW4'} alt={`Logo ${z.name}`} className="w-full h-full object-cover" />
              </div>
            </div>

            <div className="px-4 pb-4 pt-0 space-y-2">
              <button type="button" className="w-full flex items-center justify-center gap-2 rounded-lg h-10 bg-[#10264D] hover:bg-[#12305f] text-[#7FB2FF] font-semibold text-sm transition-colors active:scale-[0.98] transform duration-100" onClick={() => navigate(`/admin/season-zones/${z.zone_id}/teams`)}>
                <span className="material-symbols-outlined text-[18px]">settings_accessibility</span>
                Gestionar Equipos
              </button>
              <button 
                type="button" 
                className="w-full flex items-center justify-center gap-2 rounded-lg h-10 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-200 font-semibold text-sm transition-colors active:scale-[0.98] transform duration-100" 
                onClick={() => navigate(`/admin/seasons/${seasonId}/zones/${z.zone_id}/rankings`)}
              >
                <span className="material-symbols-outlined text-[18px]">emoji_events</span>
                Rankings
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark text-slate-900 dark:text-white font-display">
      {/* Top app bar */}
      <div className="sticky top-0 z-50 flex items-center justify-between p-4 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-white"
          title="Volver"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>

        <h2 className="text-lg font-bold leading-tight tracking-tight flex-1 text-center">Gestión de Zonas</h2>

        <button
          type="button"
          onClick={openCreate}
          className="flex items-center justify-center w-10 h-10 rounded-full bg-primary hover:bg-primary-hover text-white transition-colors shadow-lg shadow-primary/30"
        >
          <span className="material-symbols-outlined">add</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pb-8">
        {/* Season banner */}
        <div className="px-4 py-4 w-full max-w-lg mx-auto">
          <div className="relative overflow-hidden rounded-xl shadow-lg group">
            <img
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              src={selectedSeason?.banner_url || 'https://lh3.googleusercontent.com/aida-public/AB6AXuCN_Cv6sXTxpGwXviCgfa7buQj3upvYWuRk4DUPp2QrZQ1RvqjaC3Z7FmNlh0Fcb_07hblKMzGYt-nXfnuXDJM9yPkTAB4Cd3WnQKCs0VU6fayBW4b3wgPuMKqxodJqyqg4vTQOjp7QXOJLHnrG67KeTK8mPs1TIasZJLQs-izW6bFXAbk4j2Dyv2SF45f28OcQWpTdX5XjZKVnrQegFVr3-6q1Bj7fQQtkwWZH3OmOX6bt7JeADgDRE3p_sSbsiT6pyct77G8ApCs'}
              alt="Season banner"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
            <div className="relative z-10 p-6 flex flex-col justify-end min-h-[160px]">
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-primary text-white">Activa</span>
              </div>
              <h1 className="text-3xl font-bold text-white tracking-tight">{selectedSeason?.description ?? 'Temporada'}</h1>
              <p className="text-slate-300 text-sm mt-1 font-medium">{selectedSeason?.season_id ?? ''}</p>
            </div>
            <button className="absolute top-3 right-3 p-2 rounded-full bg-black/30 backdrop-blur-md text-white hover:bg-black/50 transition-colors">
              <span className="material-symbols-outlined text-[20px]">edit</span>
            </button>
          </div>
        </div>

        <div className="px-4 pb-2 pt-2 w-full max-w-lg mx-auto flex justify-between items-end">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Lista de Zonas</h3>
          <span className="text-xs font-medium text-text-secondary">{zonesCount} Zonas activas</span>
        </div>

          <div className="px-4 w-full max-w-lg mx-auto">
            {renderZones()}
          </div>
          {renderModal()}
        </div>
      </div>

      
    
  );
}

