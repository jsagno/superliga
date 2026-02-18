import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

function initialsFromName(name) {
  const s = (name || "").trim();
  if (!s) return "?";
  const parts = s.split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? "?";
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] : (parts[0]?.[1] ?? "");
  return (a + (b || "")).toUpperCase();
}

function isValidHttpUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export default function TeamsList() {
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState([]); // {team_id,name,logo,created_at}

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("team")
      .select("team_id,name,logo,created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setTeams([]);
      setLoading(false);
      return;
    }

    setTeams(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return teams;
    return teams.filter((t) => (t.name || "").toLowerCase().includes(s));
  }, [q, teams]);

  async function onDelete(team) {
    if (!confirm(`Eliminar equipo "${team.name}"?`)) return;

    const { error } = await supabase.from("team").delete().eq("team_id", team.team_id);
    if (error) {
      // Si está asignado a temporadas/zonas, probablemente falle por FK restrict
      alert(`No se pudo eliminar: ${error.message}`);
      return;
    }
    await load();
  }

  return (
    <div className="w-full bg-slate-50 dark:bg-[#101622] min-h-screen">
      {/* Top bar */}
      <header className="sticky top-0 z-20 bg-slate-50/95 dark:bg-[#101622]/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
        <div className="w-full max-w-3xl mx-auto flex items-center justify-between px-4 py-3">
          <button
            onClick={() => nav(-1)}
            className="flex items-center justify-center w-10 h-10 -ml-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-slate-600 dark:text-slate-300"
            aria-label="Volver"
          >
            <span className="material-symbols-outlined text-2xl">arrow_back_ios_new</span>
          </button>

          <h1 className="text-lg font-bold tracking-tight">Gestión de Equipos</h1>

          <button
            onClick={() => nav("/admin/teams/new")}
            className="flex items-center justify-center w-10 h-10 -mr-2 rounded-full text-[#1152d4] hover:bg-[#1152d4]/10 transition-colors"
            aria-label="Agregar equipo"
          >
            <span className="material-symbols-outlined text-3xl font-semibold">add</span>
          </button>
        </div>
      </header>

      {/* Search */}
      <div className="px-4 py-4 sticky top-[64px] z-10 bg-transparent">
        <div className="w-full max-w-3xl mx-auto px-0">
          <div className="relative flex items-center w-full h-12 rounded-xl bg-white dark:bg-[#1c2333] shadow-sm ring-1 ring-gray-900/5 dark:ring-white/10 focus-within:ring-2 focus-within:ring-[#1152d4] transition-all">
            <div className="flex items-center justify-center pl-4 pr-2 text-slate-400">
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
                <path
                  d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>

            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full h-full bg-transparent border-none text-base placeholder:text-slate-400 text-slate-900 dark:text-white focus:ring-0 p-0 pr-4 outline-none"
              placeholder="Buscar equipo..."
              type="text"
            />
          </div>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 px-4 pb-24 space-y-3 overflow-y-auto">
        <div className="w-full max-w-3xl mx-auto py-4">
          {loading ? (
            <div className="text-slate-500 dark:text-slate-300 px-1">Cargando...</div>
          ) : filtered.length === 0 ? (
            <div className="text-slate-500 dark:text-slate-300 px-1">No hay equipos.</div>
          ) : (
            filtered.map((t) => {
              const logo = (t.logo || "").trim();
              const hasLogo = !!logo;
              const showImg = hasLogo && isValidHttpUrl(logo);
              const initials = initialsFromName(t.name);

              return (
                <div
                  key={t.team_id}
                  className="group relative flex items-center p-3 rounded-xl bg-white dark:bg-[#1c2333] shadow-sm border border-gray-100 dark:border-gray-800 hover:border-[#1152d4]/50 dark:hover:border-[#1152d4]/50 transition-all"
                >
                  {/* Avatar */}
                  <div className="relative shrink-0 mr-4">
                    <div className="w-14 h-14 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden ring-2 ring-white dark:ring-gray-800 shadow-md flex items-center justify-center">
                      {showImg ? (
                        <img
                          alt={`Logo ${t.name}`}
                          src={logo}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center font-bold text-lg text-white bg-indigo-600">
                          {initials}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 mr-2">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
                      {t.name}
                    </h3>

                    <p className="text-sm text-slate-500 dark:text-slate-400 truncate flex items-center gap-1">
                      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none">
                        <path
                          d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                        <path
                          d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                        <path
                          d="M22 21v-2a4 4 0 0 0-3-3.87"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                        <path
                          d="M16 3.13a4 4 0 0 1 0 7.75"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                      </svg>
                      {hasLogo ? "Logo cargado" : "Sin logo"}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => nav(`/admin/teams/${t.team_id}`)}
                      aria-label="Editar"
                      className="w-9 h-9 flex items-center justify-center rounded-lg text-[#1152d4] bg-[#1152d4]/10 hover:bg-[#1152d4] hover:text-white transition-colors"
                    >
                      <span className="material-symbols-outlined text-[20px]">edit</span>
                    </button>

                    <button
                      onClick={() => onDelete(t)}
                      aria-label="Eliminar"
                      className="w-9 h-9 flex items-center justify-center rounded-lg text-red-500 bg-red-500/10 hover:bg-red-500 hover:text-white transition-colors"
                    >
                      <span className="material-symbols-outlined text-[20px]">delete</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
