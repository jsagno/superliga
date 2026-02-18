import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

// Helper para formatear fecha
function fmtDateTime(iso) {
  if (!iso) return { adjusted: "—", original: "—" };
  const original = new Date(iso);
  
  const gameTime = new Date(iso);
  gameTime.setUTCMinutes(gameTime.getUTCMinutes() - 590);
  
  const year = gameTime.getUTCFullYear();
  const month = String(gameTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(gameTime.getUTCDate()).padStart(2, '0');
  
  const hours = String(original.getHours()).padStart(2, '0');
  const minutes = String(original.getMinutes()).padStart(2, '0');
  const seconds = String(original.getSeconds()).padStart(2, '0');
  
  return {
    adjusted: `${day}/${month}/${year}, ${hours}:${minutes}:${seconds}`,
    original: original.toUTCString()
  };
}

function computeBattleSummary({ battle, rounds, playersById }) {
  const roundNos = [...new Set(rounds.map(r => r.round_no))].sort((a,b)=>a-b);

  const perRound = roundNos.map((rn) => {
    const rows = rounds.filter(x => x.round_no === rn);
    const team = rows.filter(x => x.side === "TEAM");
    const opp = rows.filter(x => x.side === "OPPONENT");

    const teamCrowns = team.length > 0 ? (team[0].crowns ?? 0) : 0;
    const oppCrowns = team.length > 0 && team[0].opponent_crowns !== null && team[0].opponent_crowns !== undefined 
      ? team[0].opponent_crowns 
      : (opp.length > 0 ? (opp[0].crowns ?? 0) : 0);

    let winner = "DRAW";
    if (teamCrowns > oppCrowns) winner = "TEAM";
    if (oppCrowns > teamCrowns) winner = "OPPONENT";

    return { roundNo: rn, teamCrowns, oppCrowns, winner, team, opp };
  });

  const teamRoundsWon = perRound.filter(r => r.winner === "TEAM").length;
  const oppRoundsWon = perRound.filter(r => r.winner === "OPPONENT").length;

  const teamPlayers = [...new Set(rounds.filter(r => r.side === "TEAM").map(r => r.player_id))];
  const oppPlayers = [...new Set(rounds.filter(r => r.side === "OPPONENT").map(r => r.player_id))];
  
  let titleLeft, titleRight;
  
  if (teamPlayers.length > 1) {
    const names = teamPlayers.map(pid => {
      const p = playersById[pid];
      return p?.nick || p?.name || pid;
    });
    titleLeft = names.join(" + ");
  } else if (teamPlayers.length === 1) {
    const p = playersById[teamPlayers[0]];
    titleLeft = p?.nick || p?.name || teamPlayers[0];
  } else {
    titleLeft = "—";
  }

  if (oppPlayers.length > 1) {
    const names = oppPlayers.map(pid => {
      const p = playersById[pid];
      return p?.nick || p?.name || pid;
    });
    titleRight = names.join(" + ");
  } else if (oppPlayers.length === 1) {
    const p = playersById[oppPlayers[0]];
    titleRight = p?.nick || p?.name || oppPlayers[0];
  } else {
    // Check for unregistered opponents
    const unregistered = perRound[0]?.team?.[0]?.opponent;
    if (unregistered) {
      const oppData = Array.isArray(unregistered) ? unregistered[0] : unregistered;
      titleRight = oppData?.name || oppData?.tag || "—";
    } else {
      titleRight = "—";
    }
  }

  let winner = "DRAW";
  if (teamRoundsWon > oppRoundsWon) winner = "LEFT";
  if (oppRoundsWon > teamRoundsWon) winner = "RIGHT";

  return {
    titleLeft,
    titleRight,
    teamRoundsWon,
    oppRoundsWon,
    winner,
    perRound
  };
}

async function fetchBattleDetails(battleId) {
  // Fetch battle
  const { data: battle, error: e1 } = await supabase
    .from("battle")
    .select("*")
    .eq("battle_id", battleId)
    .single();
    
  if (e1 || !battle) throw new Error("Battle not found");

  // Fetch rounds
  const { data: battleRounds, error: e2 } = await supabase
    .from("battle_round")
    .select("battle_round_id, battle_id, round_no")
    .eq("battle_id", battleId);
    
  if (e2) throw e2;
  
  const roundIds = (battleRounds || []).map(r => r.battle_round_id);
  
  // Fetch round players
  const { data: roundPlayers, error: e3 } = await supabase
    .from("battle_round_player")
    .select("*")
    .in("battle_round_id", roundIds);
    
  if (e3) throw e3;

  // Merge round data with player data
  const rounds = (roundPlayers || []).map(rp => {
    const br = battleRounds.find(r => r.battle_round_id === rp.battle_round_id);
    return { ...rp, ...br };
  });

  // Get unique player IDs
  const playerIds = [...new Set(rounds.map(r => r.player_id).filter(Boolean))];
  
  // Fetch players
  const { data: players, error: e4 } = await supabase
    .from("player")
    .select("player_id, name, nick")
    .in("player_id", playerIds);
    
  if (e4) throw e4;

  const playersById = {};
  (players || []).forEach(p => {
    playersById[p.player_id] = p;
  });

  // Fetch cards
  const { data: cards, error: e5 } = await supabase
    .from("card")
    .select("card_id, raw_payload");
    
  if (e5) throw e5;

  const cardsById = {};
  (cards || []).forEach(c => {
    cardsById[c.card_id] = c.raw_payload;
  });

  return { battle, rounds, playersById, cardsById };
}

function getCardImageUrl(cardId, evolutionLevel, cardsById) {
  const cardData = cardsById[cardId];
  if (cardData && cardData.iconUrls) {
    // Evolution level 2: use heroMedium
    if (evolutionLevel === 2 && cardData.iconUrls.heroMedium) {
      return cardData.iconUrls.heroMedium;
    }
    // Evolution level 1: use evolutionMedium
    if (evolutionLevel === 1 && cardData.iconUrls.evolutionMedium) {
      return cardData.iconUrls.evolutionMedium;
    }
    // Otherwise use regular medium image
    if (cardData.iconUrls.medium) {
      return cardData.iconUrls.medium;
    }
  }
  return null;
}

function getDisplayLevel(cardId, battleLevel, evolutionLevel, cardsById) {
  if (!battleLevel) return battleLevel;
  const cardData = cardsById[cardId];
  if (!cardData) return battleLevel + (evolutionLevel || 0);
  
  // Formula: battleLevel + (16 - maxLevel)
  const displayLevel = battleLevel + (16 - (cardData.maxLevel || 16));
  return displayLevel;
}

export default function BattleDetailModal({ battleId, onClose }) {
  const [loading, setLoading] = useState(true);
  const [battle, setBattle] = useState(null);
  const [rounds, setRounds] = useState([]);
  const [playersById, setPlayersById] = useState({});
  const [cardsById, setCardsById] = useState({});
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    if (!battleId) return;

    (async () => {
      setLoading(true);
      try {
        const data = await fetchBattleDetails(battleId);
        setBattle(data.battle);
        setRounds(data.rounds);
        setPlayersById(data.playersById);
        setCardsById(data.cardsById);
        
        const s = computeBattleSummary({
          battle: data.battle,
          rounds: data.rounds,
          playersById: data.playersById
        });
        setSummary(s);
      } catch (e) {
        console.error("Error loading battle:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [battleId]);

  if (!battleId) return null;

  const winnerLeft = summary?.winner === "LEFT";
  const winnerRight = summary?.winner === "RIGHT";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 overflow-y-auto">
      <div className="w-full max-w-5xl rounded-2xl border border-white/10 bg-[#0a0f1b] overflow-hidden my-8">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-blue-500/10 to-purple-500/10">
          <div>
            <div className="text-lg font-semibold">Detalle de Batalla</div>
            <div className="text-sm text-white/60">Battle ID: {battleId}</div>
          </div>
          <button
            onClick={onClose}
            className="h-10 w-10 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition flex items-center justify-center"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[calc(100vh-200px)] overflow-y-auto">
          {loading ? (
            <div className="text-center py-8 text-white/70">Cargando batalla...</div>
          ) : !battle ? (
            <div className="text-center py-8 text-white/70">Batalla no encontrada</div>
          ) : (
            <div>
              {/* Battle header info */}
              <div className="flex flex-col gap-3 mb-6 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-slate-900/60 px-3 py-2" title={`UTC: ${fmtDateTime(battle.battle_time).original}`}>
                    <div className="text-xs text-white/60">Fecha</div>
                    <div className="text-sm cursor-help">{fmtDateTime(battle.battle_time).adjusted}</div>
                  </div>

                  <div className="rounded-xl bg-slate-900/60 px-3 py-2">
                    <div className="text-xs text-white/60">Modo</div>
                    <div className="text-sm">{battle.api_game_mode || "—"}</div>
                  </div>

                  <div className="rounded-xl bg-slate-900/60 px-3 py-2">
                    <div className="text-xs text-white/60">Tipo</div>
                    <div className="text-sm">{battle.api_battle_type || "—"}</div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs text-white/60">Resultado</div>
                  <div className="text-base font-semibold">
                    <span className={winnerLeft ? "text-emerald-400" : "text-white"}>
                      {summary.teamRoundsWon}
                    </span>
                    <span className="text-white/40 mx-2">-</span>
                    <span className={winnerRight ? "text-emerald-400" : "text-white"}>
                      {summary.oppRoundsWon}
                    </span>
                  </div>
                </div>
              </div>

              {/* Players vs */}
              <div className="mb-6 flex items-center justify-center gap-4">
                <div className="flex-1 text-right">
                  <div className={`text-lg font-bold ${winnerLeft ? "text-emerald-400" : "text-white"}`}>
                    {summary.titleLeft}
                  </div>
                  <div className="text-sm text-white/60">TEAM</div>
                </div>
                <div className="text-2xl font-bold text-white/40">VS</div>
                <div className="flex-1 text-left">
                  <div className={`text-lg font-bold ${winnerRight ? "text-emerald-400" : "text-white"}`}>
                    {summary.titleRight}
                  </div>
                  <div className="text-sm text-white/60">OPPONENT</div>
                </div>
              </div>

              {/* Rounds */}
              <div className="space-y-4">
                {summary.perRound.map((rr) => (
                  <div key={rr.roundNo} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="text-sm font-semibold text-white/80">
                        Ronda {rr.roundNo}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={rr.winner === "TEAM" ? "text-emerald-400 font-bold" : "text-white/70"}>
                          👑 {rr.teamCrowns}
                        </span>
                        <span className="text-white/40">-</span>
                        <span className={rr.winner === "OPPONENT" ? "text-emerald-400 font-bold" : "text-white/70"}>
                          👑 {rr.oppCrowns}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* TEAM players */}
                      <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                        <div className="mb-2 text-xs text-white/60">TEAM</div>
                        {(rr.team || []).map((teamRecord) => {
                          const pl = playersById[teamRecord.player_id];
                          const plName = pl?.nick || pl?.name || teamRecord.player_id;
                          const plCards = Array.isArray(teamRecord.deck_cards) ? teamRecord.deck_cards : [];
                          
                          return (
                            <div key={teamRecord.player_id} className="mb-3 last:mb-0">
                              <div className="flex items-center justify-between mb-2">
                                <div className="text-sm font-semibold">{plName}</div>
                                <div className="text-xs text-white/70">👑 {rr.teamCrowns ?? 0}</div>
                              </div>
                              <div className="grid grid-cols-4 gap-2">
                                {plCards.slice(0, 8).map((c, idx) => {
                                  const imageUrl = getCardImageUrl(c.id, c.evolution_level, cardsById);
                                  
                                  return (
                                    <div
                                      key={idx}
                                      className="rounded-lg overflow-hidden border border-white/10 bg-slate-950/40 relative group"
                                      title={`${c.name || cardsById[c.id]?.name || "card"} (lvl ${c.level ?? "?"})`}
                                    >
                                      {imageUrl ? (
                                        <img
                                          src={imageUrl}
                                          alt={c.name || "card"}
                                          className="w-full h-full object-contain"
                                          onError={(e) => {
                                            e.target.style.display = "none";
                                            e.target.nextElementSibling.style.display = "block";
                                          }}
                                        />
                                      ) : (
                                        <div className="w-full h-full aspect-square bg-slate-950/60 flex items-center justify-center text-center text-[10px] text-white/70 p-1">
                                          <span>{c.name || cardsById[c.id]?.name || "—"}</span>
                                        </div>
                                      )}
                                      <div
                                        className="absolute inset-0 hidden w-full h-full bg-slate-950/60 flex items-center justify-center text-center text-[10px] text-white/70 p-1"
                                      >
                                        <span>{c.name || cardsById[c.id]?.name || "—"}</span>
                                      </div>
                                      {c.level && (
                                        <div className="absolute top-0 left-0 bg-black/80 rounded-br-md px-1.5 py-0.5 text-[10px] font-bold text-white border-b border-r border-white/20">
                                          {getDisplayLevel(c.id, c.level, c.evolution_level, cardsById)}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* OPPONENT players */}
                      <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                        <div className="mb-2 text-xs text-white/60">OPPONENT</div>
                        {(rr.opp && rr.opp.length > 0) ? (
                          (rr.opp || []).map((oppRecord) => {
                            const pl = playersById[oppRecord.player_id];
                            const oppName = pl?.nick || pl?.name || oppRecord.player_id;
                            const oppCards = Array.isArray(oppRecord.deck_cards) ? oppRecord.deck_cards : [];
                            
                            return (
                              <div key={oppRecord.player_id} className="mb-3 last:mb-0">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="text-sm font-semibold">{oppName}</div>
                                  <div className="text-xs text-white/70">👑 {rr.oppCrowns ?? 0}</div>
                                </div>
                                <div className="grid grid-cols-4 gap-2">
                                  {oppCards.slice(0, 8).map((c, idx) => {
                                    const imageUrl = getCardImageUrl(c.id, c.evolution_level, cardsById);
                                    
                                    return (
                                      <div
                                        key={idx}
                                        className="rounded-lg overflow-hidden border border-white/10 bg-slate-950/40 relative group"
                                        title={`${c.name || cardsById[c.id]?.name || "card"} (lvl ${c.level ?? "?"})`}
                                      >
                                        {imageUrl ? (
                                          <img
                                            src={imageUrl}
                                            alt={c.name || "card"}
                                            className="w-full h-full object-contain"
                                            onError={(e) => {
                                              e.target.style.display = "none";
                                              e.target.nextElementSibling.style.display = "block";
                                            }}
                                          />
                                        ) : (
                                          <div className="w-full h-full aspect-square bg-slate-950/60 flex items-center justify-center text-center text-[10px] text-white/70 p-1">
                                            <span>{c.name || cardsById[c.id]?.name || "—"}</span>
                                          </div>
                                        )}
                                        <div
                                          className="absolute inset-0 hidden w-full h-full bg-slate-950/60 flex items-center justify-center text-center text-[10px] text-white/70 p-1"
                                        >
                                          <span>{c.name || cardsById[c.id]?.name || "—"}</span>
                                        </div>
                                        {c.level && (
                                          <div className="absolute top-0 left-0 bg-black/80 rounded-br-md px-1.5 py-0.5 text-[10px] font-bold text-white border-b border-r border-white/20">
                                            {getDisplayLevel(c.id, c.level, c.evolution_level, cardsById)}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          // Unregistered opponents
                          (rr.team || []).flatMap((teamRecord) => {
                            const unregisteredOpponents = teamRecord.opponent ? (Array.isArray(teamRecord.opponent) ? teamRecord.opponent : [teamRecord.opponent]) : [];
                            return unregisteredOpponents.map((opp, idx) => {
                              const oppName = opp.name || opp.tag || "Unknown";
                              const oppCards = Array.isArray(opp.deck_cards) ? opp.deck_cards : [];
                              return (
                                <div key={`unreg-opp-${idx}`} className="mb-3 last:mb-0">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="text-sm font-semibold text-white/80">{oppName}</div>
                                    <div className="text-xs text-white/70">👑 {rr.oppCrowns ?? 0}</div>
                                  </div>
                                  <div className="text-xs text-white/50 mb-2">(No registrado)</div>
                                  <div className="grid grid-cols-4 gap-2">
                                    {oppCards.slice(0, 8).map((c, cidx) => {
                                      const imageUrl = getCardImageUrl(c.id, c.evolution_level, cardsById);
                                      
                                      return (
                                        <div
                                          key={cidx}
                                          className="rounded-lg overflow-hidden border border-white/10 bg-slate-950/40 relative group"
                                          title={`${c.name || cardsById[c.id]?.name || "card"} (lvl ${c.level ?? "?"})`}
                                        >
                                          {imageUrl ? (
                                            <img
                                              src={imageUrl}
                                              alt={c.name || "card"}
                                              className="w-full h-full object-contain"
                                              onError={(e) => {
                                                e.target.style.display = "none";
                                                e.target.nextElementSibling.style.display = "block";
                                              }}
                                            />
                                          ) : (
                                            <div className="w-full h-full aspect-square bg-slate-950/60 flex items-center justify-center text-center text-[10px] text-white/70 p-1">
                                              <span>{c.name || cardsById[c.id]?.name || "—"}</span>
                                            </div>
                                          )}
                                          <div
                                            className="absolute inset-0 hidden w-full h-full bg-slate-950/60 flex items-center justify-center text-center text-[10px] text-white/70 p-1"
                                          >
                                            <span>{c.name || cardsById[c.id]?.name || "—"}</span>
                                          </div>
                                          {c.level && (
                                            <div className="absolute top-0 left-0 bg-black/80 rounded-br-md px-1.5 py-0.5 text-[10px] font-bold text-white border-b border-r border-white/20">
                                              {getDisplayLevel(c.id, c.level, c.evolution_level, cardsById)}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            });
                          })
                        )}
                        {(!rr.opp || rr.opp.length === 0) && (!rr.team || rr.team.every(t => !t.opponent)) && (
                          <div className="text-xs text-white/50">Sin datos de oponente</div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
