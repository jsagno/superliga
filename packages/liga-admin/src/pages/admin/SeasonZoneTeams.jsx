import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient.js"; // ajustá el path si tu proyecto lo tiene en otro lado

export default function SeasonZoneTeams() {
  const navigate = useNavigate();
  const { zoneId } = useParams(); // route: /admin/zones/:zoneId/teams
  const [loading, setLoading] = useState(true);

  const [zone, setZone] = useState(null);
  const [season, setSeason] = useState(null);
  const [assignedSeasonTeamIds, setAssignedSeasonTeamIds] = useState([]); // team_ids assigned anywhere in this season
  const [assigned, setAssigned] = useState([]); // season_zone_team + team
  const [allTeams, setAllTeams] = useState([]);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Add modal state
  const [showAdd, setShowAdd] = useState(false);
  const [addTeamId, setAddTeamId] = useState("");
  const [addTeamOrder, setAddTeamOrder] = useState("");

  // Inline edit order
  const [editOrders, setEditOrders] = useState({}); // {season_zone_team_id: number|string}
  const [savingId, setSavingId] = useState(null);

  const assignedTeamIds = useMemo(() => new Set(assigned.map((r) => r.team_id)), [assigned]);

  const availableTeams = useMemo(() => {
    const blocked = new Set(assignedSeasonTeamIds || []);
    for (const id of assignedTeamIds) blocked.add(id);
    return allTeams.filter((t) => !blocked.has(t.team_id));
  }, [allTeams, assignedSeasonTeamIds, assignedTeamIds]);

  useEffect(() => {
    if (!zoneId) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoneId]);

  async function load() {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      // 1) Load zone
      const zoneRes = await supabase
        .from("season_zone")
        .select("zone_id, season_id, name, zone_order, created_at, last_snapshot_at")
        .eq("zone_id", zoneId)        
        .maybeSingle();

      if (zoneRes.error) throw zoneRes.error;
      if (!zoneRes.data) throw new Error("Zona no encontrada.");

      setZone(zoneRes.data);

      // Load season info for display if available
      try {
        const sId = zoneRes.data?.season_id;
        if (sId) {
          const seasonRes = await supabase
            .from("season")
            .select("season_id, description")
            .eq("season_id", sId)
            .maybeSingle();
          if (!seasonRes.error) setSeason(seasonRes.data || null);

          // Also fetch all zone ids for this season and then all assigned team_ids
          try {
            const zonesRes = await supabase
              .from("season_zone")
              .select("zone_id")
              .eq("season_id", sId);
            if (!zonesRes.error && Array.isArray(zonesRes.data)) {
              const zoneIds = zonesRes.data.map((z) => z.zone_id).filter(Boolean);
              if (zoneIds.length > 0) {
                const seasonAssignedRes = await supabase
                  .from("season_zone_team")
                  .select("team_id,zone_id")
                  .in("zone_id", zoneIds);
                if (!seasonAssignedRes.error && Array.isArray(seasonAssignedRes.data)) {
                  const ids = Array.from(new Set(seasonAssignedRes.data.map((r) => r.team_id).filter(Boolean)));
                  setAssignedSeasonTeamIds(ids);
                }
              }
            }
          } catch (eZoneIds) {
            // non-fatal
            // eslint-disable-next-line no-console
            console.error("failed loading season assigned team ids:", eZoneIds);
          }
        }
      } catch (seErr) {
        // non-fatal — we can still show the page without season description
        // eslint-disable-next-line no-console
        console.error("failed loading season info:", seErr);
      }

      // 2) Load assigned teams for zone (join team). If the db doesn't expose
      // the relationship on REST (causing a 400 Bad Request), fall back to
      // fetching the season_zone_team rows first and then fetching teams
      // separately and merging client-side.
      const assignedRes = await supabase
        .from("season_zone_team")
        .select(`season_zone_team_id,zone_id,team_id,team_order,team(team_id,name,logo)`)
        .eq("zone_id", zoneId)
        .order("team_order", { ascending: true });

      // Build assignedRows either from the relationship select or via fallback
      // (fetch base rows and then teams separately). We declare `assignedRows`
      // here so it's available for the seeding logic below regardless of path.
      let assignedRows = [];
      if (assignedRes.error) {
        // Log detailed error to console for debugging (Supabase error object)
        // and attempt fallback strategy.
        // eslint-disable-next-line no-console
        console.error("season_zone_team select failed:", assignedRes.error);

        // Fallback: fetch rows without the relationship
        const baseRes = await supabase
          .from("season_zone_team")
          .select("season_zone_team_id,zone_id,team_id,team_order")
          .eq("zone_id", zoneId)
          .order("team_order", { ascending: true });

        if (baseRes.error) throw baseRes.error;

        const baseRows = baseRes.data || [];

        if (baseRows.length === 0) {
          assignedRows = [];
        } else {
          // Fetch all team records needed
          const teamIds = baseRows.map((r) => r.team_id).filter(Boolean);
          let teamsMap = {};
          if (teamIds.length > 0) {
            const teamsRes = await supabase
              .from("team")
              .select("team_id,name,logo")
              .in("team_id", teamIds);

            if (!teamsRes.error && Array.isArray(teamsRes.data)) {
              teamsMap = Object.fromEntries(teamsRes.data.map((t) => [t.team_id, t]));
            } else {
              // If team fetch failed, still continue with empty team objects
              // eslint-disable-next-line no-console
              console.error("team fetch failed in fallback:", teamsRes.error);
            }
          }

          assignedRows = baseRows.map((r) => ({ ...r, team: teamsMap[r.team_id] || {} }));
        }
      } else {
        assignedRows = assignedRes.data || [];
      }

      // Set state once using the resolved assignedRows
      setAssigned(assignedRows);

      // seed edit orders
      const seed = {};
      for (const r of assignedRows) seed[r.season_zone_team_id] = r.team_order ?? "";
      setEditOrders(seed);

      // 3) Load all teams (global)
      const teamsRes = await supabase
        .from("team")
        .select("team_id, name, logo, created_at")
        .order("name", { ascending: true });

      if (teamsRes.error) throw teamsRes.error;
      setAllTeams(teamsRes.data || []);
    } catch (e) {
      setError(e?.message || "Error cargando datos.");
    } finally {
      setLoading(false);
    }
  }

  function flashSuccess(msg) {
    setSuccess(msg);
    setTimeout(() => setSuccess(""), 2500);
  }

  async function handleAddTeam(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!addTeamId) {
      setError("Seleccioná un equipo.");
      return;
    }

    // default order: (max + 1)
    const maxOrder = assigned.reduce((acc, r) => Math.max(acc, Number(r.team_order || 0)), 0);
    const desiredOrder = addTeamOrder !== "" ? Number(addTeamOrder) : maxOrder + 1;

    try {
      const insertRes = await supabase.from("season_zone_team").insert([
        {
          zone_id: zoneId,
          team_id: addTeamId,
          team_order: desiredOrder,
        },
      ]);

      if (insertRes.error) throw insertRes.error;

      setShowAdd(false);
      setAddTeamId("");
      setAddTeamOrder("");
      flashSuccess("Equipo asignado a la zona.");
      await load();
    } catch (e) {
      // constraint unique? (si ya existe)
      setError(e?.message || "No se pudo asignar el equipo.");
    }
  }

  async function handleDelete(seasonZoneTeamId) {
    setError("");
    setSuccess("");
    if (!confirm("¿Eliminar este equipo de la zona?")) return;

    try {
      const delRes = await supabase
        .from("season_zone_team")
        .delete()
        .eq("season_zone_team_id", seasonZoneTeamId);

      if (delRes.error) throw delRes.error;

      flashSuccess("Equipo eliminado de la zona.");
      await load();
    } catch (e) {
      setError(e?.message || "No se pudo eliminar.");
    }
  }

  async function handleSaveOrder(seasonZoneTeamId) {
    setError("");
    setSuccess("");
    const raw = editOrders[seasonZoneTeamId];

    if (raw === "" || raw === null || raw === undefined) {
      setError("El orden no puede estar vacío.");
      return;
    }
    const val = Number(raw);
    if (!Number.isFinite(val) || val < 1) {
      setError("El orden debe ser un número (>= 1).");
      return;
    }

    try {
      setSavingId(seasonZoneTeamId);
      const upRes = await supabase
        .from("season_zone_team")
        .update({ team_order: val })
        .eq("season_zone_team_id", seasonZoneTeamId);

      if (upRes.error) throw upRes.error;

      flashSuccess("Orden actualizado.");
      await load();
    } catch (e) {
      setError(e?.message || "No se pudo actualizar el orden.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <>
      <div className="min-h-[calc(100vh-64px)] bg-[#0B1220] text-white">
        <div className="mx-auto w-full max-w-6xl px-4 py-6">
          {/* Header */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(-1)}
                className="rounded-xl bg-white/5 px-3 py-2 text-sm text-white/90 hover:bg-white/10"
              >
                ← Volver
              </button>
              <div>
                <div className="text-xl font-semibold">Asignación de Equipos</div>
                <div className="text-sm text-white/60">Gestionar equipos por zona</div>
              </div>
            </div>

            <button
              onClick={() => setShowAdd(true)}
              className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15"
            >
              + Asignar Equipo
            </button>
          </div>

          {/* Season summary (outside the zone card — applies to all zones) */}
          {season ? (
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm text-white/60">
                Temporada: <span className="text-white/80">{season.description}</span>
                <span className="ml-3 text-xs text-white/50">{season.season_id}</span>
              </div>
            </div>
          ) : null}

          {/* Alerts */}
          {error ? (
            <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}
          {success ? (
            <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
              {success}
            </div>
          ) : null}

          {/* Zone Card */}
          <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
            {loading ? (
              <div className="text-sm text-white/60">Cargando zona...</div>
            ) : zone ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-lg font-semibold">{zone.name || "Zona"}</div>
                  <div className="text-sm text-white/60">
                    Zone ID: <span className="text-white/80">{zone.zone_id}</span> · Orden:{" "}
                    <span className="text-white/80">{zone.zone_order ?? "-"}</span>
                  </div>
                </div>
                <div className="text-sm text-white/60">
                  Last snapshot:{" "}
                  <span className="text-white/80">
                    {zone.last_snapshot ? new Date(zone.last_snapshot).toLocaleString() : "—"}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-sm text-white/60">Zona no encontrada.</div>
            )}
          </div>

          {/* List */}
          <div className="mt-6">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-lg font-semibold">Equipos Asignados</div>
              <div className="text-sm text-white/60">{assigned.length} equipos</div>
            </div>

            <div className="space-y-3">
              {loading ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
                  Cargando...
                </div>
              ) : assigned.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/60">
                  No hay equipos asignados a esta zona.
                </div>
              ) : (
                assigned.map((row) => {
                  const t = row.team || {};
                  return (
                    <div
                      key={row.season_zone_team_id}
                      className="rounded-2xl border border-white/10 bg-white/5 p-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-12 w-12 overflow-hidden rounded-xl bg-black/30 ring-1 ring-white/10">
                            {t.logo ? (
                              <img
                                src={t.logo}
                                alt={t.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-white/40">
                                🛡️
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="text-base font-semibold">
                              {t.name || "Equipo"}
                              {t.short_name ? (
                                <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/70">
                                  {t.short_name}
                                </span>
                              ) : null}
                            </div>
                            <div className="text-xs text-white/60">
                              Team ID: <span className="text-white/70">{row.team_id}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-white/60">Orden</span>
                            <input
                              value={editOrders[row.season_zone_team_id] ?? ""}
                              onChange={(e) =>
                                setEditOrders((prev) => ({
                                  ...prev,
                                  [row.season_zone_team_id]: e.target.value,
                                }))
                              }
                              className="w-20 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-white/20"
                              placeholder="1"
                              inputMode="numeric"
                            />
                            <button
                              onClick={() => handleSaveOrder(row.season_zone_team_id)}
                              disabled={savingId === row.season_zone_team_id}
                              className="rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold hover:bg-white/15 disabled:opacity-60"
                            >
                              {savingId === row.season_zone_team_id ? "Guardando..." : "Guardar"}
                            </button>
                          </div>

                          <button
                            onClick={() => handleDelete(row.season_zone_team_id)}
                            className="rounded-xl bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-200 hover:bg-red-500/15"
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Add modal */}
        {showAdd ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#0F172A] p-5 shadow-2xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-lg font-semibold">Asignar equipo a la zona</div>
                  <div className="text-sm text-white/60">Elegí un equipo y su orden</div>
                </div>
                <button
                  onClick={() => setShowAdd(false)}
                  className="rounded-xl bg-white/5 px-3 py-2 text-sm text-white/80 hover:bg-white/10"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleAddTeam} className="mt-4 space-y-4">
                <div>
                  <label className="text-xs font-semibold text-white/70">Equipo</label>
                  <select
                    value={addTeamId}
                    onChange={(e) => setAddTeamId(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-white/20"
                  >
                    <option value="">— Seleccionar —</option>
                    {availableTeams.map((t) => (
                      <option key={t.team_id} value={t.team_id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  {availableTeams.length === 0 ? (
                    <div className="mt-2 text-xs text-white/50">
                      No hay equipos disponibles (todos ya están asignados a esta zona).
                    </div>
                  ) : null}
                </div>

                <div>
                  <label className="text-xs font-semibold text-white/70">
                    Orden (opcional)
                  </label>
                  <input
                    value={addTeamOrder}
                    onChange={(e) => setAddTeamOrder(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-white/20"
                    placeholder="Si no ponés nada, se asigna al final"
                    inputMode="numeric"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAdd(false)}
                    className="rounded-xl bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15"
                  >
                    Asignar
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
