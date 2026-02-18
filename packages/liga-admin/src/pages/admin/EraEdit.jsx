import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

export default function EraEdit() {
  const { eraId } = useParams();
  const isNew = eraId === "new";
  const nav = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [description, setDescription] = useState("");

  const title = useMemo(() => (isNew ? "Nueva Era" : "Editar Era"), [isNew]);

  useEffect(() => {
    (async () => {
      setLoading(true);

      if (isNew) {
        setDescription("");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("era")
        .select("era_id,description")
        .eq("era_id", eraId)
        .maybeSingle();

      if (error) {
        alert(error.message);
        setLoading(false);
        return;
      }

      if (!data) {
        alert("Era no encontrada.");
        nav("/admin/eras");
        return;
      }

      setDescription(data.description ?? "");
      setLoading(false);
    })();
  }, [isNew, eraId, nav]);

  function canSave() {
    return description.trim().length > 0;
  }

  async function save() {
    if (!canSave()) {
      alert("La descripción es obligatoria.");
      return;
    }

    setSaving(true);

    const payload = { description: description.trim() };

    if (isNew) {
      const { data, error } = await supabase.from("era").insert([payload]).select("era_id").single();
      if (error) {
        alert(error.message);
        setSaving(false);
        return;
      }
      setSaving(false);
      nav(`/admin/eras/${data.era_id}`);
      return;
    }

    const { error } = await supabase.from("era").update(payload).eq("era_id", eraId);
    if (error) {
      alert(error.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    nav("/admin/eras");
  }

  async function onDelete() {
    if (isNew) {
      nav("/admin/eras");
      return;
    }

    if (!confirm("Eliminar esta era? (Si tiene temporadas asociadas, va a fallar por FK)")) return;

    const { error } = await supabase.from("era").delete().eq("era_id", eraId);
    if (error) {
      alert(`No se pudo eliminar: ${error.message}`);
      return;
    }

    nav("/admin/eras");
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
            <div className="w-full flex flex-col gap-5">
              <div className="flex flex-col w-full gap-2">
                <label className="text-slate-700 dark:text-slate-300 text-sm font-semibold leading-normal ml-1">
                  Descripción
                </label>
                <input
                  className="flex w-full h-14 rounded-xl text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1c2333] focus:border-[#1152d4] focus:ring-1 focus:ring-[#1152d4] p-4 text-base transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  placeholder="Ej. ERA 5"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={80}
                />
                <p className="text-xs text-slate-500 dark:text-slate-400 ml-1">
                  Se usa para agrupar temporadas.
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
                onClick={() => nav("/admin/eras")}
                className="flex w-full items-center justify-center rounded-xl bg-transparent border border-transparent h-12 px-5 transition-all hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium"
              >
                Cancelar
              </button>

              <button
                onClick={onDelete}
                className="mt-2 flex w-full items-center justify-center rounded-xl bg-red-50 dark:bg-red-900/10 h-10 px-5 transition-all hover:bg-red-100 dark:hover:bg-red-900/20 group"
              >
                <span className="text-red-600 dark:text-red-400 text-sm font-medium leading-normal group-hover:underline">
                  {isNew ? "Descartar" : "Eliminar esta era"}
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
