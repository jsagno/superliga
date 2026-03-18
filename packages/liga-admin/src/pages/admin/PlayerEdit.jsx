import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import unnamed from "../../assets/unnamed.png";

function normalizeTag(tag) {
  if (!tag) return "";
  let t = tag.trim().toUpperCase();
  if (!t) return "";
  if (!t.startsWith("#")) t = "#" + t;
  return t;
}

export default function PlayerEdit() {
  const { playerId } = useParams();
  const isNew = playerId === "new";
  const nav = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [nick, setNick] = useState("");
  const [tag, setTag] = useState("");
  const [discordUserId, setDiscordUserId] = useState("");
  const [active, setActive] = useState(true);
  const [avatar, setAvatar] = useState(null);

  const title = useMemo(() => (isNew ? "Add Player" : "Edit Player"), [isNew]);

  useEffect(() => {
    if (isNew) {
      setLoading(false);
      return;
    }

    (async () => {
      setLoading(true);

      const { data: pData, error: pErr } = await supabase
        .from("player")
        .select("player_id,name,nick,discord_user_id")
        .eq("player_id", playerId)
        .maybeSingle();

      if (pErr) {
        alert(pErr.message);
        setLoading(false);
        return;
      }

      setName(pData?.name ?? "");
      setNick(pData?.nick ?? "");
      setDiscordUserId(pData?.discord_user_id ?? "");
      // try to pick an avatar URL from common fields if present
      const foundAvatar =
        pData?.avatar_url || pData?.photo_url || pData?.image_url || pData?.photo || pData?.avatar || null;
      setAvatar(foundAvatar);

      // current tag
      const { data: tData } = await supabase
        .from("v_player_current_tag")
        .select("player_tag")
        .eq("player_id", playerId)
        .maybeSingle();

      setTag(tData?.player_tag ?? "");
      setLoading(false);
    })();
  }, [isNew, playerId]);

  async function save() {
    setSaving(true);

    const cleanTag = normalizeTag(tag);
    const nowIso = new Date().toISOString();

    // 1) upsert player
    let pid = playerId;

    if (isNew) {
      const { data, error } = await supabase
        .from("player")
        .insert([{ 
          name: name.trim() || null, 
          nick: nick.trim() || null,
          discord_user_id: discordUserId.trim() || null
        }])
        .select("player_id")
        .single();

      if (error) {
        alert(error.message);
        setSaving(false);
        return;
      }
      pid = data.player_id;
    } else {
      const { error } = await supabase
        .from("player")
        .update({ 
          name: name.trim() || null, 
          nick: nick.trim() || null,
          discord_user_id: discordUserId.trim() || null
        })
        .eq("player_id", pid);

      if (error) {
        alert(error.message);
        setSaving(false);
        return;
      }
    }

    // 2) update identity if tag provided
    if (cleanTag) {
      // get current identity
      const { data: cur } = await supabase
        .from("v_player_current_tag")
        .select("player_tag")
        .eq("player_id", pid)
        .maybeSingle();

      const currentTag = cur?.player_tag ?? "";

      if (cleanTag !== currentTag) {
        // close old identities (valid_to = now) for this player
        await supabase
          .from("player_identity")
          .update({ valid_to: nowIso })
          .eq("player_id", pid)
          .is("valid_to", null);

        // insert new identity
        const { error: insErr } = await supabase.from("player_identity").insert([
          {
            player_id: pid,
            player_tag: cleanTag,
            valid_from: nowIso,
            valid_to: null,
          },
        ]);

        if (insErr) {
          alert(`Player saved, but tag update failed: ${insErr.message}`);
          setSaving(false);
          return;
        }
      }
    }

    setSaving(false);
    nav("/admin/players");
  }

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden max-w-md mx-auto">
      <header className="sticky top-0 z-20 flex items-center justify-between bg-slate-950/95 backdrop-blur-sm p-4 border-b border-slate-800">
        <Link to="/admin/players" className="flex items-center justify-center p-2 rounded-full hover:bg-slate-900">
          <span className="material-symbols-outlined" style={{fontSize:24}}>arrow_back</span>
        </Link>
        <h2 className="text-base text-lg font-bold leading-tight tracking-tight">{isNew ? 'Añadir Jugador' : 'Editar Jugador'}</h2>
        <div className="w-10" />
      </header>

      <main className="flex-1 px-5 py-6 flex flex-col gap-6">
        {loading ? (
          <div className="text-slate-300">Loading...</div>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-col items-center">
              <div className="relative group cursor-pointer">
                <div className="h-32 w-32 rounded-full ring-4 ring-slate-950 shadow-xl overflow-hidden bg-slate-800 transition-transform group-hover:scale-105">
                  <img
                    src={avatar || unnamed}
                    alt={nick || name || "avatar"}
                    className="w-full h-full object-cover"
                    onError={(e) => (e.currentTarget.src = unnamed)}
                  />
                </div>
                <div className="absolute bottom-1 right-1 bg-blue-600 text-white p-2 rounded-full ring-4 ring-slate-950 flex items-center justify-center shadow-md transition-transform hover:scale-110">
                  <span className="material-symbols-outlined" style={{fontSize:18}}>photo_camera</span>
                </div>
              </div>
              <button className="mt-3 text-blue-400 text-sm font-medium hover:underline">Cambiar Avatar</button>
            </div>

            <div className="space-y-5">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-slate-600 dark:text-slate-400">Nombre Completo</label>
                <div className="relative">
                  <input
                    className="w-full h-14 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1c212b] px-4 text-base font-normal text-slate-900 dark:text-white focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none placeholder:text-slate-400 transition-all"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Juan Pérez"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-slate-600 dark:text-slate-400">Nick</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                    <span className="material-symbols-outlined text-slate-400" style={{fontSize:20}}>person</span>
                  </div>
                  <input
                    className="w-full h-14 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1c212b] pl-11 pr-4 text-base font-normal text-slate-900 dark:text-white focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none placeholder:text-slate-400 transition-all"
                    value={nick}
                    onChange={(e) => setNick(e.target.value)}
                    placeholder="JuanKing"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-slate-600 dark:text-slate-400 flex justify-between">
                  Tag de Clash Royale
                  <span className="text-xs font-normal text-slate-500">Visible en perfil de CR</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-slate-400 font-bold text-lg">#</div>
                  <input
                    className="w-full h-14 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1c212b] pl-10 pr-12 text-base font-normal text-slate-900 dark:text-white uppercase tracking-widest focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none placeholder:text-slate-400 transition-all"
                    value={tag}
                    onChange={(e) => setTag(e.target.value)}
                    placeholder="2PU82R"
                  />
                <div class="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                  <img alt="Crown Icon" class="h-6 w-6 opacity-50 grayscale invert dark:invert-0" data-alt="Small crown icon indicating game rank" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCGhG4cclcOMHasxYDqhwUfVwofPkF-TtxFrSj7McxJMkPuWxp_TEOXipqM6bhjQgaS4xugnDmeBlzQeFOer-WHWruqFVa7hp_0p9ECGjvc79i0lRMtfPcM--ufPB8kwacz7KeFORspgKDA19My--UTR9SD_nmkT_gHLvynApVPrfxRhogzMVcy9MlQfXZJvjySQRMqrYz5WzhrNS1q4zlX5hjHVGW_Sq_zPLyfrBkeliDJMp2rt6I45D0mB8DV_tBixhPF2Czg7jE" />
                </div>                </div>
                <p className="text-xs text-slate-500 mt-2">Si cambia, se cierra el tag anterior (valid_to) y se inserta uno nuevo con valid_from.</p>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-slate-600 dark:text-slate-400 flex justify-between">
                  Discord User ID
                  <span className="text-xs font-normal text-slate-500">Para menciones en notificaciones</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                    <span className="material-symbols-outlined text-slate-400" style={{fontSize:20}}>tag</span>
                  </div>
                  <input
                    className="w-full h-14 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1c212b] pl-11 pr-4 text-base font-normal text-slate-900 dark:text-white focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none placeholder:text-slate-400 transition-all"
                    value={discordUserId}
                    onChange={(e) => setDiscordUserId(e.target.value)}
                    placeholder="123456789012345678"
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1">ID numérico de Discord. Puedes encontrarlo habilitando modo desarrollador en Discord.</p>
              </div>
              
              <div className="mt-2 bg-white dark:bg-[#1c212b] rounded-xl p-4 border border-slate-200 dark:border-slate-700 flex items-center justify-between shadow-sm">
                <div className="flex flex-col gap-0.5">
                  <span className="text-base font-medium text-slate-100">Jugador Activo</span>
                  <span className="text-xs text-slate-400">Permitir participación en torneos</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input checked={active} onChange={(e)=>setActive(e.target.checked)} type="checkbox" className="sr-only peer" />
                  <div className="w-12 h-7 bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-600/20 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="sticky bottom-0 bg-slate-950 p-4 border-t border-slate-800">
        <div className="flex flex-col gap-3">
          <button
            onClick={save}
            disabled={saving}
            className="w-full h-14 text-white font-semibold rounded-xl text-base transition-all flex items-center justify-center gap-2"
            style={{
              backgroundColor: "#2563eb",
              boxShadow: "0 6px 20px rgba(37,99,235,0.18)",
            }}
          >
            {saving ? (
              "Saving..."
            ) : (
              <>
                <span className="material-symbols-outlined">save</span>
                Guardar Cambios
              </>
            )}
          </button>
          <Link
            to="/admin/players"
            className="w-full h-14 bg-transparent font-semibold rounded-xl text-base transition-all flex items-center justify-center"
            style={{
              color: "#cbd5e1",
              border: "1px solid rgba(148,163,184,0.12)",
            }}
          >
            Cancelar
          </Link>
        </div>
      </footer>
    </div>
  );
}