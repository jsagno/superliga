import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

export default function EraList() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [eras, setEras] = useState([]);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("era")
      .select("era_id,description,created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setEras([]);
      setLoading(false);
      return;
    }

    setEras(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const newest = useMemo(() => eras[0] || null, [eras]);
  const rest = useMemo(() => (eras.length > 1 ? eras.slice(1) : []), [eras]);

  async function onDelete(era) {
    if (!confirm(`Eliminar era "${era.description}"?`)) return;

    const { error } = await supabase.from("era").delete().eq("era_id", era.era_id);
    if (error) {
      // si hay seasons apuntando a esta era -> fallará por FK
      alert(`No se pudo eliminar: ${error.message}`);
      return;
    }
    await load();
  }

  return (
    <div className="bg-[#f6f6f8] dark:bg-[#101622] font-display min-h-screen flex flex-col overflow-x-hidden antialiased transition-colors duration-300">
      {/* Top App Bar */}
      <header className="sticky top-0 z-50 w-full bg-[#f6f6f8]/90 dark:bg-[#101622]/90 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between px-4 py-3 max-w-lg mx-auto w-full">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Eras</h1>

          <button
            onClick={() => nav("/admin/eras/new")}
            className="group flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-[#1152d4] text-white hover:bg-[#1152d4]/90 active:scale-95 transition-all shadow-lg shadow-[#1152d4]/20"
            aria-label="Agregar era"
          >
            <span className="material-symbols-outlined font-semibold group-hover:rotate-90 transition-transform duration-300">
              add
            </span>
          </button>
        </div>
      </header>

      <main className="flex-1 w-full max-w-lg mx-auto p-4 flex flex-col gap-4">
        <div className="flex items-center justify-between pb-2">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Era más reciente
          </p>
        </div>

        {loading ? (
          <div className="text-gray-500 dark:text-gray-300">Cargando...</div>
        ) : !newest ? (
          <article className="rounded-xl bg-white dark:bg-[#1e2736] shadow-sm border border-gray-100 dark:border-gray-800 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                  <span className="material-symbols-outlined text-xl">info</span>
                </div>
                <div>
                  <h2 className="text-base font-semibold text-gray-900 dark:text-white">No hay eras</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Creá la primera era.</p>
                </div>
              </div>

              <button
                onClick={() => nav("/admin/eras/new")}
                className="h-9 px-3 rounded-lg bg-gray-100 dark:bg-gray-800 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                Crear
              </button>
            </div>
          </article>
        ) : (
          <article className="relative overflow-hidden rounded-xl bg-white dark:bg-[#1e2736] shadow-md border-l-4 border-[#1152d4]">
            <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-[#1152d4]/10 rounded-full blur-2xl"></div>

            <div className="relative p-5 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex gap-4 min-w-0">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#1152d4]/10 text-[#1152d4]">
                    <span className="material-symbols-outlined text-[28px] fill-1">timeline</span>
                  </div>

                  <div className="min-w-0">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white leading-tight truncate">
                      {newest.description}
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Creada:{" "}
                      {new Date(newest.created_at).toLocaleDateString("es-AR", {
                        year: "numeric",
                        month: "short",
                        day: "2-digit",
                      })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => nav(`/admin/eras/${newest.era_id}`)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
                    aria-label="Editar era"
                  >
                    <span className="material-symbols-outlined">edit</span>
                  </button>

                  <button
                    onClick={() => onDelete(newest)}
                    className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
                    aria-label="Eliminar era"
                  >
                    <span className="material-symbols-outlined">delete</span>
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

        {!loading && rest.length === 0 ? (
          <div className="flex justify-center pt-4 pb-8">
            <span className="text-xs text-gray-400 dark:text-gray-600 font-medium">No hay más eras</span>
          </div>
        ) : (
          rest.map((e, idx) => {
            const isOlder = idx >= 2;
            return (
              <article
                key={e.era_id}
                className={[
                  "group relative flex flex-col rounded-xl bg-white dark:bg-[#1e2736] shadow-sm border border-gray-100 dark:border-gray-800 transition-all hover:border-gray-300 dark:hover:border-gray-700",
                  isOlder ? "opacity-75 hover:opacity-100" : "",
                ].join(" ")}
              >
                <div className="p-4 flex items-center gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 group-hover:bg-gray-200 dark:group-hover:bg-gray-700 transition-colors">
                    <span className="material-symbols-outlined text-xl">{isOlder ? "history" : "timeline"}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white truncate">
                      {e.description}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {new Date(e.created_at).toLocaleDateString("es-AR", {
                        year: "numeric",
                        month: "short",
                        day: "2-digit",
                      })}
                    </p>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => nav(`/admin/eras/${e.era_id}`)}
                      className="h-8 w-8 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors"
                      aria-label="Editar"
                    >
                      <span className="material-symbols-outlined text-xl">edit</span>
                    </button>

                    <button
                      onClick={() => onDelete(e)}
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
