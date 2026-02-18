import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

function fmtDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString();
}

async function getBattleIdsForPlayer(playerId, mode) {
  const { data: rp, error } = await supabase
    .from("battle_round_player")
    .select("battle_round_id")
    .eq("player_id", playerId)
    .limit(5000);
  if (error) throw error;

  const roundIds = (rp || []).map(x => x.battle_round_id).filter(Boolean);
  if (!roundIds.length) return [];

  const { data: br, error: e2 } = await supabase
    .from("battle_round")
    .select("battle_round_id,battle_id")
    .in("battle_round_id", roundIds);
  if (e2) throw e2;

  const battleIds = Array.from(new Set((br || []).map(x => x.battle_id).filter(Boolean)));
  if (!battleIds.length) return [];

  // filtramos por modo en battle
  let qb = supabase.from("battle").select("battle_id").in("battle_id", battleIds);
  if (mode) qb = qb.eq("api_game_mode", mode);

  const { data: b, error: e3 } = await qb;
  if (e3) throw e3;

  return (b || []).map(x => x.battle_id);
}

async function fetchBattleListMinimal(battleIds) {
  if (!battleIds.length) return [];

  const { data, error } = await supabase
    .from("battle")
    .select("battle_id,battle_time,api_game_mode,api_battle_type,round_count")
    .in("battle_id", battleIds)
    .order("battle_time", { ascending: false })
    .limit(50);

  if (error) throw error;
  return data || [];
}

export default function BattlesHistoryPicker({
  open,
  onClose,
  playerAId,
  playerBId,
  mode, // opcional
  onPickBattle, // (battle) => void
}) {
  const [loading, setLoading] = useState(false);
  const [battles, setBattles] = useState([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!open) return;

    (async () => {
      setLoading(true);
      try {
        if (!playerAId || !playerBId) {
          setBattles([]);
          return;
        }

        // 1) traemos battleIds de A
        const aIds = await getBattleIdsForPlayer(playerAId, mode);

        // 2) de esos ids, vemos cuáles también contienen B
        //    -> buscamos battle_round_player donde player_id=B y battle_round_id pertenece a battle_round de esos battleIds
        //    hacemos por pasos (robusto)
        if (!aIds.length) {
          setBattles([]);
          return;
        }

        const { data: br, error: e1 } = await supabase
          .from("battle_round")
          .select("battle_round_id,battle_id")
          .in("battle_id", aIds);
        if (e1) throw e1;

        const roundIds = (br || []).map(x => x.battle_round_id);
        if (!roundIds.length) {
          setBattles([]);
          return;
        }

        const { data: rpB, error: e2 } = await supabase
          .from("battle_round_player")
          .select("battle_round_id")
          .eq("player_id", playerBId)
          .in("battle_round_id", roundIds);
        if (e2) throw e2;

        const bRoundIds = new Set((rpB || []).map(x => x.battle_round_id));
        const intersectionBattleIds = Array.from(
          new Set((br || []).filter(x => bRoundIds.has(x.battle_round_id)).map(x => x.battle_id))
        );

        const list = await fetchBattleListMinimal(intersectionBattleIds);
        setBattles(list);
      } catch (err) {
        console.error(err);
        setBattles([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, playerAId, playerBId, mode]);

  const filtered = useMemo(() => {
    if (!q) return battles;
    const qq = q.toLowerCase();
    return battles.filter(b =>
      (b.api_game_mode || "").toLowerCase().includes(qq) ||
      (b.api_battle_type || "").toLowerCase().includes(qq) ||
      (b.battle_id || "").toLowerCase().includes(qq)
    );
  }, [battles, q]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 p-4">
      <div className="mx-auto mt-10 w-full max-w-3xl rounded-2xl border border-white/10 bg-slate-950 text-white shadow-xl">
        <div className="flex items-center justify-between border-b border-white/10 p-4">
          <div>
            <div className="text-lg font-semibold">Seleccionar batalla</div>
            <div className="text-xs text-white/60">
              Filtrado por ambos jugadores {mode ? `• modo: ${mode}` : ""}
            </div>
          </div>
          <button
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
            onClick={onClose}
          >
            Cerrar
          </button>
        </div>

        <div className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <input
              className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm outline-none focus:border-blue-500"
              placeholder="Buscar por modo, tipo o battle_id…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          {loading && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/70">
              Cargando…
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/70">
              No se encontraron batallas para esos dos jugadores.
            </div>
          )}

          <div className="max-h-[60vh] space-y-2 overflow-auto pr-1">
            {filtered.map((b) => (
              <button
                key={b.battle_id}
                onClick={() => onPickBattle?.(b)}
                className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-left hover:bg-white/10"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">
                      {b.api_game_mode || "—"} <span className="text-white/40">•</span>{" "}
                      {b.api_battle_type || "—"}{" "}
                      {b.round_count > 1 ? <span className="text-xs text-white/50">• duelo</span> : null}
                    </div>
                    <div className="text-xs text-white/60">{fmtDateTime(b.battle_time)}</div>
                  </div>
                  <div className="text-xs text-white/50">{b.battle_id}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-white/10 p-4 text-xs text-white/50">
          Tip: esto es ideal para “Vincular batalla” de copas (duelo diario se linkea automático).
        </div>
      </div>
    </div>
  );
}
