import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

function toDateInput(value) {
  // value can be date string YYYY-MM-DD or timestamptz
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function toDateTimeLocalInput(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function fromDateTimeLocalToIso(value) {
  // "YYYY-MM-DDTHH:mm" -> ISO string
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export default function SeasonEdit() {
  const { seasonId } = useParams();
  const isNew = seasonId === "new";
  const nav = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // eras
  const [eras, setEras] = useState([]);

  // form
  const [eraId, setEraId] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("DRAFT");

  const [duelStartDate, setDuelStartDate] = useState("");
  const [ladderStartDate, setLadderStartDate] = useState("");

  const [seasonStartAt, setSeasonStartAt] = useState("");
  const [seasonEndAt, setSeasonEndAt] = useState("");

  const title = useMemo(() => (isNew ? "Nueva Temporada" : "Editar Temporada"), [isNew]);

  useEffect(() => {
    (async () => {
      setLoading(true);

      // load eras
      const { data: eData, error: eErr } = await supabase
        .from("era")
        .select("era_id,description,created_at")
        .order("created_at", { ascending: false });

      if (eErr) {
        alert(eErr.message);
        setEras([]);
      } else {
        setEras(eData ?? []);
      }

      if (isNew) {
        // default era: most recent
        const firstEra = (eData ?? [])[0];
        setEraId(firstEra?.era_id ?? "");
        setStatus("DRAFT");
        setDescription("");
        setDuelStartDate("");
        setLadderStartDate("");
        setSeasonStartAt("");
        setSeasonEndAt("");
        setLoading(false);
        return;
      }

      // load season
      const { data: sData, error: sErr } = await supabase
        .from("season")
        .select("season_id,era_id,description,status,duel_start_date,ladder_start_date,season_start_at,season_end_at")
        .eq("season_id", seasonId)
        .maybeSingle();

      if (sErr) {
        alert(sErr.message);
        setLoading(false);
        return;
      }

      setEraId(sData?.era_id ?? "");
      setDescription(sData?.description ?? "");
      setStatus((sData?.status ?? "DRAFT").toUpperCase());

      setDuelStartDate(toDateInput(sData?.duel_start_date));
      setLadderStartDate(toDateInput(sData?.ladder_start_date));

      setSeasonStartAt(toDateTimeLocalInput(sData?.season_start_at));
      setSeasonEndAt(toDateTimeLocalInput(sData?.season_end_at));

      setLoading(false);
    })();
  }, [isNew, seasonId]);

  function canSave() {
    if (!eraId) return false;
    if (!description.trim()) return false;
    if (!["DRAFT", "ACTIVE", "CLOSED"].includes(status)) return false;
    return true;
  }

  async function save() {
    if (!canSave()) {
      alert("Completá Era + Descripción (y status válido).");
      return;
    }

    setSaving(true);

    const payload = {
      era_id: eraId,
      description: description.trim(),
      status,
      duel_start_date: duelStartDate || null,
      ladder_start_date: ladderStartDate || null,
      season_start_at: fromDateTimeLocalToIso(seasonStartAt),
      season_end_at: fromDateTimeLocalToIso(seasonEndAt),
    };

    if (isNew) {
      const { data, error } = await supabase.from("season").insert([payload]).select("season_id").single();
      if (error) {
        alert(error.message);
        setSaving(false);
        return;
      }
      setSaving(false);
      nav(`/admin/seasons/${data.season_id}`);
      return;
    }

    const { error } = await supabase.from("season").update(payload).eq("season_id", seasonId);
    if (error) {
      alert(error.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    nav("/admin/seasons");
  }

  async function onDelete() {
    if (isNew) {
      nav("/admin/seasons");
      return;
    }
    if (!confirm("Eliminar esta temporada? (Esto borrará zonas relacionadas por cascade)")) return;

    const { error } = await supabase.from("season").delete().eq("season_id", seasonId);
    if (error) {
      alert(`No se pudo eliminar: ${error.message}`);
      return;
    }
    nav("/admin/seasons");
  }

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col bg-[#f6f6f8] dark:bg-[#101622] overflow-x-hidden font-display antialiased">
      {/* TopAppBar */}
      <div className="sticky top-0 z-50 bg-[#f6f6f8]/80 dark:bg-[#101622]/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center p-4 justify-between h-16 max-w-lg mx-auto w-full">
          <button
            onClick={() => nav(-1)}
            className="flex size-10 shrink-0 items-center justify-center rounded-full text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            aria-label="Volver"
          >
            <span className="material-symbols-outlined">arrow_back_ios_new</span>
          </button>

          <h2 className="text-slate-900 dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center">
            {title}
          </h2>

          <button
            onClick={save}
            disabled={saving || !canSave()}
            className="flex size-10 shrink-0 items-center justify-center rounded-full text-white bg-[#1152d4] disabled:opacity-50 hover:bg-[#1152d4]/90 active:scale-95 transition-all"
            aria-label="Guardar"
          >
            <span className="material-symbols-outlined">check</span>
          </button>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col items-center w-full max-w-lg mx-auto p-4 gap-6">
        {loading ? (
          <div className="w-full rounded-xl bg-white dark:bg-[#1c2333] border border-slate-200 dark:border-slate-800 p-4 text-slate-600 dark:text-slate-300">
            Cargando...
          </div>
        ) : (
          <>
            {/* Form */}
            <div className="w-full flex flex-col gap-5">
              {/* Era */}
              <div className="flex flex-col w-full gap-2">
                <label className="text-slate-700 dark:text-slate-300 text-sm font-semibold leading-normal ml-1">
                  Era
                </label>
                <select
                  value={eraId}
                  onChange={(e) => setEraId(e.target.value)}
                  className="flex w-full h-14 rounded-xl text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1c2333] focus:border-[#1152d4] focus:ring-1 focus:ring-[#1152d4] p-4 text-base transition-all"
                >
                  <option value="">Seleccionar era...</option>
                  {eras.map((e) => (
                    <option key={e.era_id} value={e.era_id}>
                      {e.description}
                    </option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div className="flex flex-col w-full gap-2">
                <label className="text-slate-700 dark:text-slate-300 text-sm font-semibold leading-normal ml-1">
                  Descripción
                </label>
                <input
                  className="flex w-full h-14 rounded-xl text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1c2333] focus:border-[#1152d4] focus:ring-1 focus:ring-[#1152d4] p-4 text-base transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  placeholder="Ej. Temporada 12"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              {/* Status */}
              <div className="flex items-center gap-4 bg-white dark:bg-[#1c2333] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 justify-between shadow-sm">
                <div className="flex flex-col justify-center">
                  <p className="text-slate-900 dark:text-white text-base font-medium leading-normal line-clamp-1">
                    Estado
                  </p>
                  <p className="text-slate-500 dark:text-slate-400 text-sm font-normal leading-normal line-clamp-2">
                    Draft / Active / Closed
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {["DRAFT", "ACTIVE", "CLOSED"].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatus(s)}
                      className={[
                        "h-9 px-3 rounded-lg text-xs font-bold transition-colors border",
                        status === s
                          ? "bg-[#1152d4] text-white border-[#1152d4]"
                          : "bg-transparent text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800",
                      ].join(" ")}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-1 gap-4">
                <div className="flex flex-col w-full gap-2">
                  <label className="text-slate-700 dark:text-slate-300 text-sm font-semibold leading-normal ml-1">
                    Duel Start Date (date)
                  </label>
                  <input
                    type="date"
                    value={duelStartDate}
                    onChange={(e) => setDuelStartDate(e.target.value)}
                    className="flex w-full h-14 rounded-xl text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1c2333] focus:border-[#1152d4] focus:ring-1 focus:ring-[#1152d4] p-4 text-base transition-all"
                  />
                </div>

                <div className="flex flex-col w-full gap-2">
                  <label className="text-slate-700 dark:text-slate-300 text-sm font-semibold leading-normal ml-1">
                    Ladder Start Date (date)
                  </label>
                  <input
                    type="date"
                    value={ladderStartDate}
                    onChange={(e) => setLadderStartDate(e.target.value)}
                    className="flex w-full h-14 rounded-xl text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1c2333] focus:border-[#1152d4] focus:ring-1 focus:ring-[#1152d4] p-4 text-base transition-all"
                  />
                </div>

                <div className="flex flex-col w-full gap-2">
                  <label className="text-slate-700 dark:text-slate-300 text-sm font-semibold leading-normal ml-1">
                    Season Start (timestamptz)
                  </label>
                  <input
                    type="datetime-local"
                    value={seasonStartAt}
                    onChange={(e) => setSeasonStartAt(e.target.value)}
                    className="flex w-full h-14 rounded-xl text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1c2333] focus:border-[#1152d4] focus:ring-1 focus:ring-[#1152d4] p-4 text-base transition-all"
                  />
                </div>

                <div className="flex flex-col w-full gap-2">
                  <label className="text-slate-700 dark:text-slate-300 text-sm font-semibold leading-normal ml-1">
                    Season End (timestamptz)
                  </label>
                  <input
                    type="datetime-local"
                    value={seasonEndAt}
                    onChange={(e) => setSeasonEndAt(e.target.value)}
                    className="flex w-full h-14 rounded-xl text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1c2333] focus:border-[#1152d4] focus:ring-1 focus:ring-[#1152d4] p-4 text-base transition-all"
                  />
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400 ml-1">
                  Tip: podés usar solo fechas (duel/ladder) o también start/end completos si querés rango exacto.
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="w-full flex flex-col gap-3 pb-6 pt-2">
              <button
                onClick={save}
                disabled={saving || !canSave()}
                className="flex w-full items-center justify-center rounded-xl bg-[#1152d4] h-12 px-5 transition-all hover:bg-blue-700 active:scale-95 shadow-lg shadow-[#1152d4]/25 disabled:opacity-60"
              >
                <span className="text-white text-base font-bold leading-normal">
                  {saving ? "Guardando..." : "Guardar Cambios"}
                </span>
              </button>

              <button
                onClick={() => nav("/admin/seasons")}
                className="flex w-full items-center justify-center rounded-xl bg-transparent border border-transparent h-12 px-5 transition-all hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium"
              >
                Cancelar
              </button>

              {/* Navigation Buttons */}
              {!isNew && (
                <div className="mt-4 w-full flex flex-col gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                  <p className="text-slate-600 dark:text-slate-400 text-sm font-semibold mb-1">
                    Herramientas de Temporada
                  </p>
                  
                  <button
                    onClick={() => nav(`/admin/seasons/${seasonId}/daily-points`)}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 h-10 px-4 transition-all hover:bg-emerald-100 dark:hover:bg-emerald-900/30 group"
                  >
                    <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-xl">
                      view_week
                    </span>
                    <span className="text-emerald-700 dark:text-emerald-400 text-sm font-semibold">
                      Resumen Diario
                    </span>
                  </button>

                  <button
                    onClick={() => nav(`/admin/seasons/${seasonId}/cup-matches`)}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 h-10 px-4 transition-all hover:bg-blue-100 dark:hover:bg-blue-900/30 group"
                  >
                    <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-xl">
                      sports_esports
                    </span>
                    <span className="text-blue-700 dark:text-blue-400 text-sm font-semibold">
                      Partidos Programados
                    </span>
                  </button>

                  <button
                    onClick={() => nav(`/admin/seasons/${seasonId}/zones`)}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-purple-50 dark:bg-purple-900/20 h-10 px-4 transition-all hover:bg-purple-100 dark:hover:bg-purple-900/30 group"
                  >
                    <span className="material-symbols-outlined text-purple-600 dark:text-purple-400 text-xl">
                      shield
                    </span>
                    <span className="text-purple-700 dark:text-purple-400 text-sm font-semibold">
                      Zonas
                    </span>
                  </button>

                  <button
                    onClick={() => nav(`/admin/seasons/${seasonId}/group-standings`)}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 h-10 px-4 transition-all hover:bg-amber-100 dark:hover:bg-amber-900/30 group"
                  >
                    <span className="material-symbols-outlined text-amber-600 dark:text-amber-400 text-xl">
                      leaderboard
                    </span>
                    <span className="text-amber-700 dark:text-amber-400 text-sm font-semibold">
                      Posiciones de Grupos
                    </span>
                  </button>
                </div>
              )}

              <button
                onClick={onDelete}
                className="mt-2 flex w-full items-center justify-center rounded-xl bg-red-50 dark:bg-red-900/10 h-10 px-5 transition-all hover:bg-red-100 dark:hover:bg-red-900/20 group"
              >
                <span className="text-red-600 dark:text-red-400 text-sm font-medium leading-normal group-hover:underline">
                  {isNew ? "Descartar" : "Eliminar esta temporada"}
                </span>
              </button>
            </div>
          </>
        )}

        <div className="h-5 bg-[#f6f6f8] dark:bg-[#101622]" />
      </div>
    </div>
  );
}
