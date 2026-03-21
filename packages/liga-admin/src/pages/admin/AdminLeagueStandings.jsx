import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

const LEAGUES = ["A", "B", "C"];

function formatDateTime(isoStr) {
  if (!isoStr) return null;
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

function DeltaBadge({ delta }) {
  if (delta === 0 || delta === null || delta === undefined) {
    return <span className="text-white/30 text-xs">—</span>;
  }
  if (delta > 0) {
    return <span className="text-green-400 text-xs font-semibold">▲ {delta}</span>;
  }
  return <span className="text-red-400 text-xs font-semibold">▼ {Math.abs(delta)}</span>;
}

export default function AdminLeagueStandings() {
  const navigate = useNavigate();
  const { seasonId, zoneId } = useParams();

  const [season, setSeason] = useState(null);
  const [zone, setZone] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [snapshots, setSnapshots] = useState([]);
  const [ledgerBreakdown, setLedgerBreakdown] = useState({});
  const [initialPoints, setInitialPoints] = useState({});
  const [teamsByPlayer, setTeamsByPlayer] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeLeague, setActiveLeague] = useState("A");

  useEffect(() => {
    loadData();
  }, [seasonId, zoneId]);

  async function loadData() {
    setLoading(true);
    try {
      const [seasonRes, zoneRes, snapshotRes] = await Promise.all([
        supabase.from("season").select("season_id, description").eq("season_id", seasonId).single(),
        supabase
          .from("season_zone")
          .select("zone_id, name, last_snapshot_at")
          .eq("zone_id", zoneId)
          .single(),
        supabase
          .from("player_standings_snapshot")
          .select("player_id, scope, league, position, points_total, wins, losses, delta_position, player:player!inner(nick, name), zone_id")
          .eq("season_id", seasonId)
          .eq("zone_id", zoneId)
          .eq("scope", "LEAGUE")
          .order("position"),
      ]);

      setSeason(seasonRes.data);
      setZone(zoneRes.data);
      setLastUpdated(zoneRes.data?.last_snapshot_at || null);
      setSnapshots(snapshotRes.data || []);

      const playerIds = (snapshotRes.data || []).map(s => s.player_id);

      if (playerIds.length > 0) {
        // Load ledger breakdown grouped by player + source_type
        const [ledgerRes, sztp] = await Promise.all([
          supabase
            .from("points_ledger")
            .select("player_id, source_type, points, is_reversal")
            .eq("season_id", seasonId)
            .eq("zone_id", zoneId)
            .eq("scope", "PLAYER")
            .in("player_id", playerIds),
          supabase
            .from("season_zone_team_player")
            .select("player_id, initial_points, team:team_id(team_id, name, logo)")
            .eq("zone_id", zoneId)
            .in("player_id", playerIds),
        ]);

        // Aggregate ledger per player per source_type
        const breakdown = {};
        for (const row of (ledgerRes.data || [])) {
          if (!breakdown[row.player_id]) breakdown[row.player_id] = {};
          const key = row.source_type;
          breakdown[row.player_id][key] = (breakdown[row.player_id][key] || 0) + (row.points || 0);
        }
        setLedgerBreakdown(breakdown);

        // Map initial_points per player
        const ipMap = {};
        const teamsMap = {};
        for (const row of (sztp.data || [])) {
          ipMap[row.player_id] = row.initial_points ?? 0;
          if (row.team) {
            teamsMap[row.player_id] = row.team;
          }
        }
        setInitialPoints(ipMap);
        setTeamsByPlayer(teamsMap);
      }
    } catch (err) {
      console.error("Error loading standings:", err);
    } finally {
      setLoading(false);
    }
  }

  const byLeague = {};
  for (const s of snapshots) {
    if (!byLeague[s.league]) byLeague[s.league] = [];
    byLeague[s.league].push(s);
  }

  const hasAnyData = snapshots.length > 0;

  if (loading) {
    return <div className="p-8 text-white/60">Cargando...</div>;
  }

  return (
    <div className="p-6 mx-auto max-w-5xl">
      {/* Header */}
      <div className="mb-6 flex items-start gap-4">
        <button
          onClick={() => navigate(`/admin/seasons/${seasonId}/zones`)}
          className="h-10 w-10 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">Tabla de Posiciones por Liga</h1>
          <p className="mt-1 text-sm text-white/60">
            {season?.description} — {zone?.name}
          </p>
          {lastUpdated ? (
            <p className="mt-0.5 text-xs text-white/40">
              Actualizado: {formatDateTime(lastUpdated)}
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-yellow-400/70">Sin fecha de actualización</p>
          )}
        </div>
      </div>

      {!hasAnyData ? (
        <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-8 text-center text-yellow-200/80">
          Sin datos de snapshot — ejecutar el cron de standings
        </div>
      ) : (
        <>
          {/* League tabs */}
          <div className="mb-4 flex gap-2">
            {LEAGUES.map(l => (
              <button
                key={l}
                onClick={() => setActiveLeague(l)}
                className={`px-4 py-1.5 rounded-xl text-sm font-semibold border transition ${
                  activeLeague === l
                    ? "bg-blue-500/20 border-blue-500/40 text-blue-100"
                    : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
                }`}
              >
                Liga {l}
              </button>
            ))}
          </div>

          {/* Standings table for active league */}
          {!(byLeague[activeLeague]?.length > 0) ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-white/50 text-sm">
              Sin jugadores en Liga {activeLeague}
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/5 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-white/50 text-xs">
                    <th className="px-3 py-3 text-center w-12">RNK</th>
                    <th className="px-3 py-3 text-center w-10">Δ</th>
                    <th className="px-3 py-3 text-left">Jugador</th>
                    <th className="px-3 py-3 text-center" title="Puntos iniciales (handicap)">AN</th>
                    <th className="px-3 py-3 text-center" title="Bonificaciones manuales">AC</th>
                    <th className="px-3 py-3 text-center" title="Puntos de duelos CW_DAILY">⚔️</th>
                    <th className="px-3 py-3 text-center" title="Puntos de copa (Copa de Liga + Copa Revenge)">🏆</th>
                    <th className="px-3 py-3 text-center font-bold">TOTAL</th>
                    <th className="px-3 py-3 text-center">G</th>
                    <th className="px-3 py-3 text-center">P</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {byLeague[activeLeague].map(row => {
                    const ld = ledgerBreakdown[row.player_id] || {};
                    const an = initialPoints[row.player_id] ?? 0;
                    const ac = ld["LIGA_BONUS"] || 0;
                    const duels = ld["CW_DAILY"] || 0;
                    const copa = (ld["COPA_LIGA"] || 0) + (ld["COPA_REVENGE"] || 0);
                    const nick = row.player?.nick || row.player?.name || "—";

                    return (
                      <tr key={row.player_id} className="hover:bg-white/5 transition">
                        <td className="px-3 py-3 text-center">
                          <span className={`inline-flex w-7 h-7 items-center justify-center rounded-lg font-bold text-sm ${
                            row.position === 1 ? "bg-yellow-500/30 text-yellow-300" :
                            row.position === 2 ? "bg-slate-400/20 text-slate-300" :
                            row.position === 3 ? "bg-amber-600/20 text-amber-400" :
                            "text-white/50"
                          }`}>
                            {row.position}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <DeltaBadge delta={row.delta_position} />
                        </td>
                        <td className="px-3 py-3 font-semibold">
                          <div className="flex items-center gap-2">
                            {teamsByPlayer[row.player_id]?.logo ? (
                              <img
                                src={teamsByPlayer[row.player_id].logo}
                                alt={teamsByPlayer[row.player_id].name || 'Team'}
                                className="h-6 w-6 rounded-full object-cover"
                                title={teamsByPlayer[row.player_id].name}
                              />
                            ) : (
                              <div className="h-6 w-6 rounded-full bg-white/10" />
                            )}
                            <span>{nick}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-center text-white/70">{an}</td>
                        <td className="px-3 py-3 text-center text-white/70">{ac}</td>
                        <td className="px-3 py-3 text-center text-white/70">{duels}</td>
                        <td className="px-3 py-3 text-center text-white/70">{copa}</td>
                        <td className="px-3 py-3 text-center font-bold text-white">{row.points_total}</td>
                        <td className="px-3 py-3 text-center text-green-400/70">{row.wins}</td>
                        <td className="px-3 py-3 text-center text-red-400/70">{row.losses}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
