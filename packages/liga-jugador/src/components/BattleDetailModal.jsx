// Adapted from packages/liga-admin/src/components/BattleDetailModal.jsx
// Styled for liga-jugador dark mobile palette.
import React, { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../supabaseClient.js'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${day}/${month}/${year} ${hh}:${mm}`
}

function getCardImageUrl(cardId, evolutionLevel, cardsById) {
  const c = cardsById[cardId]
  if (!c?.iconUrls) return null
  if (evolutionLevel === 2 && c.iconUrls.heroMedium) return c.iconUrls.heroMedium
  if (evolutionLevel === 1 && c.iconUrls.evolutionMedium) return c.iconUrls.evolutionMedium
  return c.iconUrls.medium ?? null
}

function getDisplayLevel(cardId, battleLevel, evolutionLevel, cardsById) {
  if (!battleLevel) return battleLevel
  const c = cardsById[cardId]
  if (!c) return battleLevel + (evolutionLevel || 0)
  return battleLevel + (16 - (c.maxLevel || 16))
}

// ─── Data fetching ────────────────────────────────────────────────────────────

async function fetchBattleDetails(battleId) {
  const [{ data: battle, error: e1 }, { data: battleRounds, error: e2 }] = await Promise.all([
    supabase.from('battle').select('*').eq('battle_id', battleId).single(),
    supabase.from('battle_round').select('battle_round_id, battle_id, round_no').eq('battle_id', battleId),
  ])

  if (e1 || !battle) throw new Error('Batalla no encontrada')
  if (e2) throw e2

  const roundIds = (battleRounds ?? []).map((r) => r.battle_round_id)

  const [{ data: roundPlayers, error: e3 }, { data: cards, error: e4 }] = await Promise.all([
    supabase.from('battle_round_player').select('*').in('battle_round_id', roundIds),
    supabase.from('card').select('card_id, raw_payload'),
  ])

  if (e3) throw e3
  if (e4) throw e4

  const rounds = (roundPlayers ?? []).map((rp) => {
    const br = (battleRounds ?? []).find((r) => r.battle_round_id === rp.battle_round_id)
    return { ...rp, ...br }
  })

  const playerIds = [...new Set(rounds.map((r) => r.player_id).filter(Boolean))]
  const { data: players, error: e5 } = playerIds.length > 0
    ? await supabase.from('player').select('player_id, name, nick').in('player_id', playerIds)
    : { data: [], error: null }
  if (e5) throw e5

  const playersById = {}
  ;(players ?? []).forEach((p) => { playersById[p.player_id] = p })

  const cardsById = {}
  ;(cards ?? []).forEach((c) => { cardsById[c.card_id] = c.raw_payload })

  return { battle, rounds, playersById, cardsById }
}

function computeSummary({ rounds, playersById }) {
  const roundNos = [...new Set(rounds.map((r) => r.round_no))].sort((a, b) => a - b)

  const perRound = roundNos.map((rn) => {
    const rows = rounds.filter((x) => x.round_no === rn)
    const team = rows.filter((x) => x.side === 'TEAM')
    const opp = rows.filter((x) => x.side === 'OPPONENT')
    const teamCrowns = team[0]?.crowns ?? 0
    const oppCrowns = team[0]?.opponent_crowns ?? opp[0]?.crowns ?? 0
    const winner = teamCrowns > oppCrowns ? 'TEAM' : oppCrowns > teamCrowns ? 'OPPONENT' : 'DRAW'
    return { roundNo: rn, teamCrowns, oppCrowns, winner, team, opp }
  })

  const teamWins = perRound.filter((r) => r.winner === 'TEAM').length
  const oppWins = perRound.filter((r) => r.winner === 'OPPONENT').length

  const playerName = (pid) => {
    const p = playersById[pid]
    return p?.nick || p?.name || pid
  }

  const teamPlayers = [...new Set(rounds.filter((r) => r.side === 'TEAM').map((r) => r.player_id))]
  const oppPlayers = [...new Set(rounds.filter((r) => r.side === 'OPPONENT').map((r) => r.player_id))]

  const titleLeft = teamPlayers.length > 0 ? teamPlayers.map(playerName).join(' + ') : '—'
  let titleRight
  if (oppPlayers.length > 0) {
    titleRight = oppPlayers.map(playerName).join(' + ')
  } else {
    const unregistered = perRound[0]?.team?.[0]?.opponent
    const oppData = Array.isArray(unregistered) ? unregistered[0] : unregistered
    titleRight = oppData?.name || oppData?.tag || '—'
  }

  return {
    titleLeft,
    titleRight,
    teamWins,
    oppWins,
    winner: teamWins > oppWins ? 'LEFT' : oppWins > teamWins ? 'RIGHT' : 'DRAW',
    perRound,
  }
}

// ─── Components ───────────────────────────────────────────────────────────────

function CardThumb({ card, cardsById }) {
  const url = getCardImageUrl(card.id, card.evolution_level, cardsById)
  const level = getDisplayLevel(card.id, card.level, card.evolution_level, cardsById)
  const name = card.name || cardsById[card.id]?.name || '—'

  return (
    <div
      className="relative rounded-lg overflow-hidden border border-white/10 bg-slate-950/60"
      title={`${name} (lvl ${level ?? '?'})`}
    >
      {url ? (
        <img
          src={url}
          alt={name}
          className="w-full h-full object-contain"
          onError={(e) => {
            e.target.style.display = 'none'
            e.target.nextElementSibling.style.display = 'flex'
          }}
        />
      ) : null}
      <div
        className={`w-full h-full aspect-square bg-slate-950/60 items-center justify-center text-center text-[10px] text-white/70 p-1 ${url ? 'hidden' : 'flex'}`}
      >
        {name}
      </div>
      {level != null && (
        <span className="absolute top-0 left-0 bg-black/80 rounded-br px-1 py-0.5 text-[9px] font-bold text-white">
          {level}
        </span>
      )}
    </div>
  )
}

function PlayerDeck({ label, records, crowns, playersById, cardsById }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3 flex-1 min-w-0">
      <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">{label}</p>
      {records.map((rec) => {
        const p = playersById[rec.player_id]
        const name = p?.nick || p?.name || rec.player_id || '—'
        const cards = Array.isArray(rec.deck_cards) ? rec.deck_cards.slice(0, 8) : []
        return (
          <div key={rec.player_id ?? label}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-200">{name}</span>
              <span className="text-xs text-slate-400">👑 {crowns}</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {cards.map((c, idx) => (
                <CardThumb key={idx} card={c} cardsById={cardsById} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export default function BattleDetailModal({ battleId, onClose }) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [summary, setSummary] = useState(null)
  const backdropRef = useRef(null)
  const closeBtnRef = useRef(null)

  useEffect(() => {
    if (!battleId) return
      let cancelled = false
      async function load() {
        setLoading(true)
        setData(null)
        setSummary(null)
        try {
          const d = await fetchBattleDetails(battleId)
          if (!cancelled) {
            setData(d)
            setSummary(computeSummary(d))
          }
        } catch (err) {
          console.error('BattleDetailModal fetch error:', err)
        } finally {
          if (!cancelled) setLoading(false)
        }
      }
      load()
      return () => { cancelled = true }
  }, [battleId])

  // Focus trap + ESC close
  useEffect(() => {
    if (!battleId) return
    const prev = document.activeElement
    closeBtnRef.current?.focus()

    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      prev?.focus()
    }
  }, [battleId, onClose])

  if (!battleId) return null

  const winL = summary?.winner === 'LEFT'
  const winR = summary?.winner === 'RIGHT'

  return (
    <div
      ref={backdropRef}
      role="dialog"
      aria-modal="true"
      aria-label="Detalle de batalla"
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/75 p-0 sm:p-4"
      onClick={(e) => { if (e.target === backdropRef.current) onClose() }}
    >
      <div className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl bg-gray-950 border border-slate-700/60 overflow-hidden flex flex-col max-h-[90dvh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/40 shrink-0">
          <div>
            <p className="text-sm font-semibold text-slate-100">Detalle de Batalla</p>
            {data && (
              <p className="text-xs text-slate-500 mt-0.5">
                {data.battle.api_game_mode ?? data.battle.api_battle_type ?? '—'} · {fmtDateTime(data.battle.battle_time)}
              </p>
            )}
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-4 py-4">
          {loading ? (
            <div className="py-12 text-center text-slate-500 text-sm">Cargando batalla…</div>
          ) : !data || !summary ? (
            <div className="py-12 text-center text-slate-500 text-sm">No se encontró la batalla</div>
          ) : (
            <div className="space-y-4">
              {/* Score summary */}
              <div className="flex items-center justify-center gap-4">
                <div className="flex-1 text-right">
                  <p className={`text-base font-bold ${winL ? 'text-emerald-400' : 'text-slate-200'}`}>
                    {summary.titleLeft}
                  </p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">TEAM</p>
                </div>
                <div className="text-center shrink-0">
                  <p className="text-xl font-bold text-slate-100">
                    <span className={winL ? 'text-emerald-400' : ''}>{summary.teamWins}</span>
                    <span className="text-slate-600 mx-1.5">—</span>
                    <span className={winR ? 'text-emerald-400' : ''}>{summary.oppWins}</span>
                  </p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">rondas</p>
                </div>
                <div className="flex-1 text-left">
                  <p className={`text-base font-bold ${winR ? 'text-emerald-400' : 'text-slate-200'}`}>
                    {summary.titleRight}
                  </p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">RIVAL</p>
                </div>
              </div>

              {/* Rounds */}
              <div className="space-y-3">
                {summary.perRound.map((rr) => (
                  <div key={rr.roundNo} className="rounded-xl border border-slate-700/40 bg-slate-800/40 p-3">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold text-slate-400">Ronda {rr.roundNo}</span>
                      <span className="text-xs font-medium">
                        <span className={rr.winner === 'TEAM' ? 'text-emerald-400 font-bold' : 'text-slate-400'}>
                          👑 {rr.teamCrowns}
                        </span>
                        <span className="text-slate-600 mx-1.5">·</span>
                        <span className={rr.winner === 'OPPONENT' ? 'text-emerald-400 font-bold' : 'text-slate-400'}>
                          👑 {rr.oppCrowns}
                        </span>
                      </span>
                    </div>

                    <div className="flex gap-2">
                      {rr.team.length > 0 && (
                        <PlayerDeck
                          label="Team"
                          records={rr.team}
                          crowns={rr.teamCrowns}
                          playersById={data.playersById}
                          cardsById={data.cardsById}
                        />
                      )}
                      {rr.opp.length > 0 && (
                        <PlayerDeck
                          label="Rival"
                          records={rr.opp}
                          crowns={rr.oppCrowns}
                          playersById={data.playersById}
                          cardsById={data.cardsById}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
