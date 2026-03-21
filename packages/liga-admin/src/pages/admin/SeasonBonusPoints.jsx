import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext";

function formatDateTime(isoStr) {
  if (!isoStr) return "—";
  const d = new Date(isoStr);
  const offsetMs = -3 * 60 * 60 * 1000;
  const local = new Date(d.getTime() + offsetMs);
  const dd = String(local.getUTCDate()).padStart(2, "0");
  const mm = String(local.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = local.getUTCFullYear();
  const hh = String(local.getUTCHours()).padStart(2, "0");
  const min = String(local.getUTCMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${min} (GMT-3)`;
}

export default function SeasonBonusPoints() {
  const navigate = useNavigate();
  const { seasonId, zoneId } = useParams();
  const { user } = useAuth();

  const [season, setSeason] = useState(null);
  const [zone, setZone] = useState(null);
  const [players, setPlayers] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [points, setPoints] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    loadData();
  }, [seasonId, zoneId]);

  async function loadData() {
    setLoading(true);
    try {
      const [seasonRes, zoneRes, playersRes, entriesRes] = await Promise.all([
        supabase.from("season").select("season_id, description").eq("season_id", seasonId).single(),
        supabase.from("season_zone").select("zone_id, name").eq("zone_id", zoneId).single(),
        supabase
          .from("season_zone_team_player")
          .select("player_id, league, player:player!inner(name, nick)")
          .eq("zone_id", zoneId)
          .is("end_date", null)
          .order("league"),
        supabase
          .from("points_ledger")
          .select("points_ledger_id, player_id, points, notes, created_at, is_reversal, reversed_ledger_id, created_by, player:player!inner(nick)")
          .eq("season_id", seasonId)
          .eq("zone_id", zoneId)
          .eq("source_type", "LIGA_BONUS")
          .order("created_at", { ascending: false }),
      ]);

      setSeason(seasonRes.data);
      setZone(zoneRes.data);
      setPlayers(playersRes.data || []);
      setEntries(entriesRes.data || []);
    } catch (err) {
      console.error("Error loading data:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selectedPlayerId || points === "") return;

    const parsedPoints = parseInt(points, 10);
    if (isNaN(parsedPoints)) return;

    setSaving(true);
    try {
      const { error } = await supabase.from("points_ledger").insert({
        scope: "PLAYER",
        season_id: seasonId,
        zone_id: zoneId,
        player_id: selectedPlayerId,
        source_type: "LIGA_BONUS",
        source_id: `manual-${Date.now()}`,
        sub_key: "bonus",
        points: parsedPoints,
        notes: notes.trim() || null,
        is_reversal: false,
        created_by: user?.id || null,
      });

      if (error) throw error;

      setSelectedPlayerId("");
      setPoints("");
      setNotes("");
      await loadData();
    } catch (err) {
      console.error("Error saving bonus:", err);
      alert(`Error al guardar: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel(entry) {
    if (!confirm(`¿Anular bonificación de ${entry.points} pts para ${entry.player?.nick}?`)) return;

    setSaving(true);
    try {
      const { error } = await supabase.from("points_ledger").insert({
        scope: "PLAYER",
        season_id: seasonId,
        zone_id: zoneId,
        player_id: entry.player_id,
        source_type: "LIGA_BONUS",
        source_id: `reversal-${entry.points_ledger_id}`,
        sub_key: "bonus",
        points: -(entry.points),
        notes: `Anulación de entrada ${entry.points_ledger_id}`,
        is_reversal: true,
        reversed_ledger_id: entry.points_ledger_id,
        created_by: user?.id || null,
      });

      if (error) throw error;
      await loadData();
    } catch (err) {
      console.error("Error cancelling entry:", err);
      alert(`Error al anular: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  // Build a set of reversed entry IDs to mark them as cancelled
  const reversedIds = new Set(
    entries
      .filter(e => e.is_reversal && e.reversed_ledger_id)
      .map(e => e.reversed_ledger_id)
  );

  if (loading) {
    return <div className="p-8 text-white/60">Cargando...</div>;
  }

  return (
    <div className="p-6 mx-auto max-w-4xl">
      {/* Header */}
      <div className="mb-6 flex items-start gap-4">
        <button
          onClick={() => navigate(`/admin/seasons/${seasonId}/zones`)}
          className="h-10 w-10 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div>
          <h1 className="text-2xl font-semibold">Bonificaciones Manuales</h1>
          <p className="mt-1 text-sm text-white/60">
            {season?.description} — {zone?.name}
          </p>
        </div>
      </div>

      {/* Add bonus form */}
      <div className="mb-8 rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-base font-semibold mb-4">Agregar bonificación</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-48">
              <label className="block text-xs text-white/60 mb-1">Jugador</label>
              <select
                value={selectedPlayerId}
                onChange={e => setSelectedPlayerId(e.target.value)}
                required
                className="w-full rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
              >
                <option value="">Seleccionar jugador...</option>
                {players.map(p => (
                  <option key={p.player_id} value={p.player_id}>
                    {p.player?.nick || p.player?.name} (Liga {p.league})
                  </option>
                ))}
              </select>
            </div>

            <div className="w-32">
              <label className="block text-xs text-white/60 mb-1">Puntos</label>
              <input
                type="number"
                value={points}
                onChange={e => setPoints(e.target.value)}
                placeholder="ej: 10 o -5"
                required
                className="w-full rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-white/60 mb-1">Notas (opcional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Motivo de la bonificación..."
              className="w-full rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-sm resize-none focus:outline-none focus:border-blue-400"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving || !selectedPlayerId || points === ""}
              className="rounded-xl px-5 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 transition font-semibold text-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Guardando..." : "Guardar bonificación"}
            </button>
          </div>
        </form>
      </div>

      {/* Existing entries */}
      <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
        <div className="border-b border-white/10 px-4 py-3">
          <h2 className="text-base font-semibold">Historial de bonificaciones</h2>
        </div>

        {entries.length === 0 ? (
          <div className="p-8 text-center text-white/60 text-sm">Sin bonificaciones registradas</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-white/50 text-xs">
                <th className="px-4 py-2 text-left">Jugador</th>
                <th className="px-4 py-2 text-right">Puntos</th>
                <th className="px-4 py-2 text-left">Notas</th>
                <th className="px-4 py-2 text-left">Fecha</th>
                <th className="px-4 py-2 text-center">Estado</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {entries.map(entry => {
                const isCancelled = reversedIds.has(entry.points_ledger_id);
                const isReversal = entry.is_reversal;
                return (
                  <tr
                    key={entry.points_ledger_id}
                    className={`hover:bg-white/5 transition ${isCancelled || isReversal ? "opacity-40" : ""}`}
                  >
                    <td className="px-4 py-3 font-medium">
                      {entry.player?.nick}
                    </td>
                    <td className={`px-4 py-3 text-right font-mono font-bold ${entry.points > 0 ? "text-green-400" : "text-red-400"}`}>
                      {entry.points > 0 ? "+" : ""}{entry.points}
                    </td>
                    <td className="px-4 py-3 text-white/60 truncate max-w-48">
                      {entry.notes || "—"}
                    </td>
                    <td className="px-4 py-3 text-white/60">
                      {formatDateTime(entry.created_at)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isReversal ? (
                        <span className="rounded-full px-2 py-0.5 text-xs bg-yellow-500/20 text-yellow-300">Anulación</span>
                      ) : isCancelled ? (
                        <span className="rounded-full px-2 py-0.5 text-xs bg-red-500/20 text-red-300">Anulada</span>
                      ) : (
                        <span className="rounded-full px-2 py-0.5 text-xs bg-green-500/20 text-green-300">Activa</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!isReversal && !isCancelled && (
                        <button
                          onClick={() => handleCancel(entry)}
                          disabled={saving}
                          className="rounded-lg px-3 py-1 text-xs bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-300 transition disabled:opacity-50"
                        >
                          Anular
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
