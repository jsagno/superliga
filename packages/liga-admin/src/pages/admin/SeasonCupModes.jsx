import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useNavigate } from "react-router-dom";

/**
 * SeasonCupModes.jsx
 * Configuración de modos por Temporada/Zona/Copa (competition) y stage.
 *
 * Tablas:
 * - season (season_id, description, duel_start_date, ladder_start_date, ...)
 * - season_zone (zone_id, season_id, name, zone_order, ...)
 * - competition (competition_id, name, short_name, logo, ...)
 * - season_zone_mode_config (season_zone_mode_config_id, season_zone_id, competition_id, stage, api_battle_type, api_game_mode, best_of, points_schema)
 */

// Opciones “humanas” => mapping a API
const MODE_PRESETS = [
  {
    key: "DUEL",
    label: "Duelo de Guerra (Duel)",
    description: "Mejor de 3 rounds por partida",
    api_battle_type: "clanMate",
    api_game_mode: "Duel_1v1_Friendly",
  },
  {
    key: "SINGLE_DRAFT",
    label: "Elección simple (Draft)",
    description: "Draft 1v1",
    api_battle_type: "clanMate",
    api_game_mode: "DraftMode",
  },
  {
    key: "TRIPLE_DRAFT",
    label: "Triple Elección (Triple Draft)",
    description: "Triple Draft 1v1",
    api_battle_type: "clanMate",
    api_game_mode: "Draft_Competitive",
  },
  {
    key: "MEGA_DRAFT",
    label: "Mega Elección (Mega Draft)",
    description: "Mega Draft 1v1",
    api_battle_type: "clanMate",
    api_game_mode: "PickMode",
  },
    {
    key: "TOUCHDOWN",
    label: "Touchdown 1v1",
    description: "Mega Draft 1v1",
    api_battle_type: "clanMate",
    api_game_mode: "Touchdown_Draft",
  }
];

const STAGES = [
  { value: "CUP_QUALY", label: "Qualy" },
  { value: "CUP_GROUP", label: "Grupos" },
  { value: "CUP_ROUND16", label: "Octavos" },
  { value: "CUP_ROUND8", label: "Cuartos" },
  { value: "CUP_SEMI", label: "Semis" },
  { value: "CUP_FINAL", label: "Final" },
];

function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

function defaultPointsSchema(bestOf = 3) {
  if (bestOf === 5) {
    return { "3-0": 6, "3-1": 5, "3-2": 4, "2-3": 2, "1-3": 1, "0-3": 0 };
  }
  return { "2-0": 4, "2-1": 3, "1-2": 1, "0-2": 0 };
}

export default function SeasonCupModes() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);

  const [seasons, setSeasons] = useState([]);
  const [seasonId, setSeasonId] = useState("");

  const [zones, setZones] = useState([]);
  const [zoneId, setZoneId] = useState("");

  const [competitions, setCompetitions] = useState([]);
  const [configs, setConfigs] = useState([]);

  // modal
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [modalCompetition, setModalCompetition] = useState(null);
  const [modalStage, setModalStage] = useState("CUP_QUALY");
  const [modalModeKey, setModalModeKey] = useState("DUEL");
  const [modalBestOf, setModalBestOf] = useState(3);
  const [modalPoints, setModalPoints] = useState(defaultPointsSchema());

  const currentPreset = useMemo(
    () => MODE_PRESETS.find((m) => m.key === modalModeKey) || MODE_PRESETS[0],
    [modalModeKey]
  );

  const zoneName = useMemo(() => {
    const z = zones.find((x) => x.zone_id === zoneId);
    return z?.name || "—";
  }, [zones, zoneId]);

  useEffect(() => {
    void bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Cuando cambia bestOf, actualizar el esquema de puntos
    if (open) {
      const currentKeys = Object.keys(modalPoints);
      const expectedKeys = Object.keys(defaultPointsSchema(modalBestOf));
      
      // Solo actualizar si las claves no coinciden (cambió de Bo3 a Bo5 o viceversa)
      if (currentKeys.length !== expectedKeys.length || !currentKeys.every(k => expectedKeys.includes(k))) {
        setModalPoints(defaultPointsSchema(modalBestOf));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalBestOf]);

  async function bootstrap() {
    setLoading(true);
    try {
      const sRes = await supabase
        .from("season")
        .select("season_id, description, duel_start_date, ladder_start_date, created_at")
        .order("created_at", { ascending: false });

      const list = sRes.data || [];
      setSeasons(list);

      if (list.length > 0) {
        const first = list[0].season_id;
        setSeasonId(first);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!seasonId) return;
    void loadZones(seasonId);
    // reset
    setZoneId("");
    setConfigs([]);
  }, [seasonId]);

  useEffect(() => {
    if (!zoneId) return;
    void loadCompetitions();
    void loadConfigs(seasonId);
  }, [zoneId]);

  async function loadZones(sid) {
    const zRes = await supabase
      .from("season_zone")
      .select("zone_id, season_id, name, zone_order, created_at")
      .eq("season_id", sid)
      .order("zone_order", { ascending: true });

    const zs = zRes.data || [];
    setZones(zs);
    if (zs.length > 0) setZoneId(zs[0].zone_id);
  }

  async function loadCompetitions() {
    // Si más adelante querés filtrar “solo copas” por tipo, agregamos campo y filtro.
    const cRes = await supabase
      .from("competition")
      .select("competition_id, name, logo")
      .order("name", { ascending: true });

    setCompetitions(cRes.data || []);
  }

  async function loadConfigs(zid) {
    const res = await supabase
      .from("season_competition_config")
      .select("season_competition_config_id, competition_id, stage, api_battle_type, api_game_mode, best_of, points_schema, updated_at")
      .eq("season_id", zid)
      .order("stage", { ascending: true });

    setConfigs(res.data || []);
  }

  function getConfig(competitionId, stage) {
    return configs.find((c) => c.competition_id === competitionId && c.stage === stage) || null;
  }

  function openModal(competition, stage) {
    const existing = getConfig(competition.competition_id, stage);

    setModalCompetition(competition);
    setModalStage(stage);

    if (existing) {
      // intenta deducir mode preset a partir del mapping guardado
      const preset =
        MODE_PRESETS.find(
          (p) => p.api_battle_type === existing.api_battle_type && p.api_game_mode === existing.api_game_mode
        ) || MODE_PRESETS[0];

      setModalModeKey(preset.key);
      const bestOf = existing.best_of || 3;
      setModalBestOf(bestOf);

      const ps = existing.points_schema || defaultPointsSchema(bestOf);
      const defaultPs = defaultPointsSchema(bestOf);
      
      // Crear objeto de puntos según el bestOf actual
      const pointsObj = {};
      Object.keys(defaultPs).forEach(key => {
        pointsObj[key] = Number(ps[key] ?? defaultPs[key]);
      });
      
      setModalPoints(pointsObj);
    } else {
      setModalModeKey("DUEL");
      setModalBestOf(3);
      setModalPoints(defaultPointsSchema(3));
    }

    setOpen(true);
  }

  async function saveModal() {
    if (!seasonId || !modalCompetition) return;

    setSaving(true);
    try {
      const payload = {
        season_id: seasonId,
        competition_id: modalCompetition.competition_id,
        stage: modalStage,
        api_battle_type: currentPreset.api_battle_type,
        api_game_mode: currentPreset.api_game_mode,
        best_of: Number(modalBestOf),
        points_schema: {
          "2-0": Number(modalPoints["2-0"]),
          "2-1": Number(modalPoints["2-1"]),
          "1-2": Number(modalPoints["1-2"]),
          "0-2": Number(modalPoints["0-2"]),
        },
      };

      const up = await supabase
        .from("season_competition_config")
        .upsert(payload, { onConflict: "season_id,competition_id,stage" })
        .select()
        .maybeSingle();

      if (up.error) throw up.error;

      await loadConfigs(seasonId);
      setOpen(false);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
      alert(e?.message || "Error guardando la configuración");
    } finally {
      setSaving(false);
    }
  }

  async function deleteConfig(competitionId, stage) {
    const existing = getConfig(competitionId, stage);
    if (!existing) return;

    if (!confirm("¿Eliminar configuración para este stage?")) return;

    const del = await supabase
      .from("season_competition_config")
      .delete()
      .eq("season_competition_config_id", existing.season_competition_config_id);

    if (del.error) {
      alert(del.error.message);
      return;
    }
    await loadConfigs(seasonId);
  }

  return (
    <div className="min-h-screen bg-[#070B14] text-white">
      {/* Background glow */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(59,130,246,0.18),transparent_55%),radial-gradient(circle_at_80%_30%,rgba(56,189,248,0.10),transparent_55%)]" />

      <div className="relative mx-auto w-full max-w-6xl px-4 py-6">
        {/* Header */}
        <div className="flex items-start gap-3">
          <button
            onClick={() => navigate(-1)}
            className="mt-1 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 ring-1 ring-white/10 hover:bg-white/10"
            aria-label="Volver"
          >
            ←
          </button>

          <div className="flex-1">
            <h1 className="text-xl font-semibold">Configuración de Modos por Copa</h1>
            <p className="mt-1 text-sm text-white/60">
              Mapeá “Duelo / Elección / Triple / Mega” a los campos reales de la API y definí Bo3/Bo5 y puntos.
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-6 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10 backdrop-blur">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-white/70">Temporada</label>
              <select
                className="mt-2 w-full rounded-xl bg-[#0B1220] px-3 py-3 text-sm ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={seasonId}
                onChange={(e) => setSeasonId(e.target.value)}
                disabled={loading}
              >
                {seasons.map((s) => (
                  <option key={s.season_id} value={s.season_id}>
                    {s.description || s.season_id}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-white/70">Zona</label>
              <select
                className="mt-2 w-full rounded-xl bg-[#0B1220] px-3 py-3 text-sm ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={zoneId}
                onChange={(e) => setZoneId(e.target.value)}
                disabled={!seasonId}
              >
                {zones.map((z) => (
                  <option key={z.zone_id} value={z.zone_id}>
                    {z.name} (Orden {z.zone_order})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 text-xs text-white/55">
            Zona seleccionada: <span className="text-white/80">{zoneName}</span>
          </div>
        </div>

        {/* Content */}
        <div className="mt-6 grid gap-4">
          <div className="rounded-2xl bg-white/5 ring-1 ring-white/10">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div>
                <div className="text-sm font-semibold">Copas / Competencias</div>
                <div className="text-xs text-white/60">Configurá por stage (Qualy/Grupos/Semis/Final)</div>
              </div>
              <div className="text-xs text-white/60">{competitions.length} competencias</div>
            </div>

            <div className="p-4">
              {(!zoneId || competitions.length === 0) ? (
                <div className="rounded-xl bg-white/5 p-4 text-sm text-white/70 ring-1 ring-white/10">
                  Seleccioná una temporada y una zona para ver las competencias.
                </div>
              ) : (
                <div className="grid gap-4">
                  {competitions.map((c) => (
                    <div key={c.competition_id} className="rounded-2xl bg-[#0B1220]/70 p-4 ring-1 ring-white/10">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="h-11 w-11 overflow-hidden rounded-xl bg-white/5 ring-1 ring-white/10">
                            {c.logo ? (
                              <img src={c.logo} alt={c.name} className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-white/30">🏆</div>
                            )}
                          </div>
                          <div>
                            <div className="text-sm font-semibold">{c.name}</div>
                            <div className="text-xs text-white/60">{c.short_name || "—"}</div>
                          </div>
                        </div>

                        <div className="text-xs text-white/55">
                          {STAGES.map((s) => Boolean(getConfig(c.competition_id, s.value))).filter(Boolean).length}/
                          {STAGES.length} stages configurados
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        {STAGES.map((s) => {
                          const cfg = getConfig(c.competition_id, s.value);

                          return (
                            <div key={s.value} className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
                              <div className="flex items-center justify-between">
                                <div className="text-sm font-medium">{s.label}</div>
                                {cfg ? (
                                  <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-[11px] text-emerald-300 ring-1 ring-emerald-500/20">
                                    Configurado
                                  </span>
                                ) : (
                                  <span className="rounded-full bg-white/5 px-2 py-1 text-[11px] text-white/60 ring-1 ring-white/10">
                                    Sin config
                                  </span>
                                )}
                              </div>

                              <div className="mt-2 text-xs text-white/60">
                                {cfg ? (
                                  <div className="space-y-1">
                                    <div>
                                      Mode: <span className="text-white/80">{cfg.api_game_mode}</span>
                                    </div>
                                    <div>
                                      Type: <span className="text-white/80">{cfg.api_battle_type}</span>
                                    </div>
                                    <div>
                                      Bo{cfg.best_of}:{" "}
                                      <span className="text-white/80">
                                        {cfg.best_of === 5 
                                          ? `${cfg.points_schema?.["3-0"] ?? 6}-${cfg.points_schema?.["3-1"] ?? 5}-${cfg.points_schema?.["3-2"] ?? 4} / ${cfg.points_schema?.["2-3"] ?? 2}-${cfg.points_schema?.["1-3"] ?? 1}-${cfg.points_schema?.["0-3"] ?? 0}`
                                          : `${cfg.points_schema?.["2-0"] ?? 4}-${cfg.points_schema?.["2-1"] ?? 3}-${cfg.points_schema?.["1-2"] ?? 1}-${cfg.points_schema?.["0-2"] ?? 0}`
                                        }
                                      </span>
                                    </div>
                                  </div>
                                ) : (
                                  "Definí modo + Bo3/Bo5 + puntos."
                                )}
                              </div>

                              <div className="mt-3 flex gap-2">
                                <button
                                  onClick={() => openModal(c, s.value)}
                                  className="flex-1 rounded-xl bg-blue-600/20 px-3 py-2 text-xs font-semibold text-blue-200 ring-1 ring-blue-500/30 hover:bg-blue-600/30"
                                >
                                  {cfg ? "Editar" : "Configurar"}
                                </button>

                                {cfg && (
                                  <button
                                    onClick={() => deleteConfig(c.competition_id, s.value)}
                                    className="rounded-xl bg-red-600/15 px-3 py-2 text-xs font-semibold text-red-200 ring-1 ring-red-500/25 hover:bg-red-600/25"
                                  >
                                    Eliminar
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal */}
        {open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
            <div className="relative w-full max-w-xl rounded-2xl bg-[#0B1220] p-5 ring-1 ring-white/10">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">Configurar modo</div>
                  <div className="mt-1 text-xs text-white/60">
                    {modalCompetition?.name} · {STAGES.find((x) => x.value === modalStage)?.label}
                  </div>
                </div>
                <button
                  className="rounded-xl bg-white/5 px-3 py-2 text-xs text-white/70 ring-1 ring-white/10 hover:bg-white/10"
                  onClick={() => setOpen(false)}
                >
                  ✕
                </button>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-white/70">Modo</label>
                  <select
                    className="mt-2 w-full rounded-xl bg-[#070B14] px-3 py-3 text-sm ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={modalModeKey}
                    onChange={(e) => setModalModeKey(e.target.value)}
                  >
                    {MODE_PRESETS.map((m) => (
                      <option key={m.key} value={m.key}>
                        {m.label}
                      </option>
                    ))}
                  </select>

                  <div className="mt-2 rounded-xl bg-white/5 p-3 text-xs text-white/60 ring-1 ring-white/10">
                    <div className="font-medium text-white/80">{currentPreset.label}</div>
                    <div className="mt-1">{currentPreset.description}</div>
                    <div className="mt-2">
                      api_battle_type: <span className="text-white/85">{currentPreset.api_battle_type}</span>
                    </div>
                    <div>
                      api_game_mode: <span className="text-white/85">{currentPreset.api_game_mode}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-white/70">Best of</label>
                  <div className="mt-2 flex gap-2">
                    {[3, 5].map((n) => (
                      <button
                        key={n}
                        onClick={() => setModalBestOf(n)}
                        className={classNames(
                          "flex-1 rounded-xl px-3 py-3 text-sm font-semibold ring-1",
                          modalBestOf === n
                            ? "bg-blue-600/25 text-blue-200 ring-blue-500/30"
                            : "bg-white/5 text-white/70 ring-white/10 hover:bg-white/10"
                        )}
                      >
                        Bo{n}
                      </button>
                    ))}
                  </div>

                  <label className="mt-4 block text-xs font-medium text-white/70">Puntos por Resultado</label>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {Object.keys(modalPoints).map((k) => (
                      <div key={k} className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
                        <div className="text-[11px] text-white/60">{k}</div>
                        <input
                          type="number"
                          className="mt-2 w-full rounded-lg bg-[#070B14] px-3 py-2 text-sm ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={modalPoints[k]}
                          onChange={(e) => setModalPoints((p) => ({ ...p, [k]: Number(e.target.value) }))}
                        />
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 text-xs text-white/55">
                    {modalBestOf === 5 
                      ? `Bo5: Gana primero a 3 (3-0, 3-1, 3-2, 2-3, 1-3, 0-3)`
                      : `Bo3: Gana primero a 2 (2-0, 2-1, 1-2, 0-2)`
                    }
                  </div>
                </div>
              </div>

              <div className="mt-5 flex justify-end gap-2">
                <button
                  onClick={() => setOpen(false)}
                  className="rounded-xl bg-white/5 px-4 py-2.5 text-sm font-semibold text-white/70 ring-1 ring-white/10 hover:bg-white/10"
                >
                  Cancelar
                </button>
                <button
                  onClick={saveModal}
                  disabled={saving}
                  className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
                >
                  {saving ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
