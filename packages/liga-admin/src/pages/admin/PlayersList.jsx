import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import unnamed from "../../assets/unnamed.png";

export default function PlayersList() {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [players, setPlayers] = useState([]); // {player_id,name,nick,created_at,current_tag}

  async function load() {
    setLoading(true);

    // 1) players
    const { data: pData, error: pErr } = await supabase
      .from("player")
      .select("player_id,name,nick,created_at")
      .order("created_at", { ascending: false });

    if (pErr) {
      console.error(pErr);
      setPlayers([]);
      setLoading(false);
      return;
    }

    const ids = (pData ?? []).map((x) => x.player_id);
    let tagMap = new Map();

    // 2) current tags (view)
    if (ids.length) {
      const { data: tData, error: tErr } = await supabase
        .from("v_player_current_tag")
        .select("player_id,player_tag")
        .in("player_id", ids);

      if (tErr) {
        console.warn("Could not load v_player_current_tag:", tErr);
      } else {
        for (const r of tData ?? []) tagMap.set(r.player_id, r.player_tag);
      }
    }

    const merged = (pData ?? []).map((p) => ({
      ...p,
      current_tag: tagMap.get(p.player_id) ?? "",
    }));

    setPlayers(merged);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return players;
    return players.filter((p) => {
      const a = (p.name ?? "").toLowerCase();
      const b = (p.nick ?? "").toLowerCase();
      const c = (p.current_tag ?? "").toLowerCase();
      return a.includes(s) || b.includes(s) || c.includes(s);
    });
  }, [players, q]);

  async function onDelete(player) {
    if (!confirm(`Delete player "${player.nick || player.name}"?`)) return;

    // ⚠️ Si tenés FK restrict desde scheduled_match, esto va a fallar.
    // Alternativa recomendada: soft delete (is_active=false).
    const { error } = await supabase.from("player").delete().eq("player_id", player.player_id);
    if (error) {
      alert(`Delete failed: ${error.message}`);
      return;
    }
    await load();
  }

  return (
    <div className="w-full">
      <div className="w-full max-w-3xl mx-auto flex items-center justify-between py-4 px-4">
        <h1 className="text-lg font-semibold">Gestión de Jugadores</h1>
        <Link to="/admin/players/new" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white">
          Añadir
        </Link>
      </div>

      <div className="sticky top-[64px] z-40 bg-transparent px-4">
        <div className="w-full max-w-3xl mx-auto px-0 py-3">
          <label className="flex flex-col h-12 w-full">
            <div className="flex w-full items-stretch rounded-xl h-full overflow-hidden">
              <div className="text-gray-400 flex items-center justify-center pl-3 pr-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M12.9 14.32a8 8 0 111.414-1.414l4.387 4.387a1 1 0 01-1.414 1.414l-4.387-4.387zM8 14a6 6 0 100-12 6 6 0 000 12z" clipRule="evenodd"/></svg>
              </div>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por nick o tag (#...)"
                className="flex-1 min-w-0 bg-slate-950 border border-slate-800 rounded-xl px-3 py-3 outline-none focus:border-blue-600"
              />
            </div>
          </label>
        </div>
      </div>

      <div className="w-full px-4">
        <div className="w-full max-w-3xl mx-auto py-4">
          {loading ? (
            <div className="text-slate-300">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="text-slate-400">No players found.</div>
          ) : (
            <div className="flex flex-col gap-4">
              {filtered.map((p) => {
                const avatar = p.avatar_url || p.photo_url || p.image || p.image_url || p.photo || p.avatar || unnamed;
                return (
                <div key={p.player_id} className="flex flex-col rounded-xl bg-slate-900/60 border border-slate-800 overflow-hidden">
                  <div className="flex p-4 gap-4 items-start">
                    <div className="w-16 h-16 rounded-lg bg-slate-800 flex-shrink-0 overflow-hidden">
                      <img
                        src={avatar}
                        alt={p.nick || p.name || "avatar"}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = unnamed;
                        }}
                      />
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-blue-400 bg-slate-950 px-2 py-0.5 rounded">{p.current_tag || "—"}</span>
                      </div>
                      <h3 className="text-lg font-bold truncate">{p.nick || "(no nick)"}</h3>
                      <p className="text-sm text-slate-400 truncate">{p.name || "—"}</p>
                    </div>
                  </div>
                  <div className="flex border-t border-slate-800/60 divide-x divide-slate-800/40">
                    <Link to={`/admin/players/${p.player_id}`} className="flex-1 py-3 flex items-center justify-center gap-2 text-sm font-medium text-slate-100 hover:bg-slate-800">Editar</Link>
                    <button onClick={() => onDelete(p)} className="flex-1 py-3 flex items-center justify-center gap-2 text-sm font-medium text-red-400 hover:bg-red-800/10">Eliminar</button>
                  </div>
                </div>
              )})}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}