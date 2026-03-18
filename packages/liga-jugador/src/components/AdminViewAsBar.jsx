/**
 * AdminViewAsBar — renders view-as controls and the impersonation banner.
 *
 * Visible only for users with role SUPER_ADMIN or SUPER_USER.
 * Contains:
 *   - Persistent banner (shown while impersonating) with player info + exit button.
 *   - "View as" trigger button (shown when NOT impersonating).
 *   - Modal with season + player selector and confirmation.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Eye, EyeOff, Search, X } from 'lucide-react'
import { usePlayerAuth } from '../context/PlayerAuthContext.jsx'
import {
  fetchSelectableSeasons,
  fetchSeasonPlayers,
} from '../services/impersonationService.js'

// ── Sub-components ────────────────────────────────────────────────────────────

function ImpersonationBanner({ target, onExit }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-0 inset-x-0 z-50 flex items-center justify-between gap-2 px-3 py-2 bg-amber-500 text-gray-950 text-sm font-medium shadow-md"
    >
      <span className="flex items-center gap-1.5 truncate">
        <Eye className="w-4 h-4 shrink-0" />
        <span className="truncate">
          Viendo como: <strong>{target.name}</strong>
        </span>
      </span>
      <button
        type="button"
        onClick={onExit}
        aria-label="Salir del modo vista como jugador"
        className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded bg-gray-950/15 hover:bg-gray-950/25 transition-colors text-xs font-semibold"
      >
        <EyeOff className="w-3.5 h-3.5" />
        Salir
      </button>
    </div>
  )
}

function ViewAsModal({ onConfirm, onClose }) {
  const [seasons, setSeasons] = useState([])
  const [selectedSeasonId, setSelectedSeasonId] = useState('')
  const [players, setPlayers] = useState([])
  const [search, setSearch] = useState('')
  const [selectedPlayer, setSelectedPlayer] = useState(null)
  const [loadingSeasons, setLoadingSeasons] = useState(true)
  const [loadingPlayers, setLoadingPlayers] = useState(false)
  const [error, setError] = useState(null)

  const searchRef = useRef(null)

  // Derived: filtered players (no extra state needed)
  const filteredPlayers = useMemo(() => {
    if (!search.trim()) return players
    const q = search.toLowerCase()
    return players.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.nick && p.nick.toLowerCase().includes(q)),
    )
  }, [search, players])

  // Load seasons
  const loadSeasons = useCallback(async () => {
    setLoadingSeasons(true)
    try {
      const data = await fetchSelectableSeasons()
      setSeasons(data)
      if (data.length > 0) setSelectedSeasonId(data[0].id)
    } catch {
      setError('Error al cargar temporadas')
    } finally {
      setLoadingSeasons(false)
    }
  }, [])

  useEffect(() => {
    loadSeasons()
  }, [loadSeasons])

  // Load players when season changes
  const loadPlayers = useCallback(async (seasonId) => {
    if (!seasonId) return
    setLoadingPlayers(true)
    setPlayers([])
    setSelectedPlayer(null)
    setSearch('')
    try {
      const data = await fetchSeasonPlayers(seasonId)
      setPlayers(data)
    } catch {
      setError('Error al cargar jugadores')
    } finally {
      setLoadingPlayers(false)
    }
  }, [])

  useEffect(() => {
    loadPlayers(selectedSeasonId)
  }, [loadPlayers, selectedSeasonId])

  // Focus search when modal opens
  useEffect(() => {
    const t = setTimeout(() => searchRef.current?.focus(), 50)
    return () => clearTimeout(t)
  }, [])

  const handleConfirm = useCallback(() => {
    if (!selectedPlayer || !selectedSeasonId) return
    const season = seasons.find((s) => s.id === selectedSeasonId)
    onConfirm({
      playerId: selectedPlayer.playerId,
      name: selectedPlayer.name,
      seasonId: selectedSeasonId,
      seasonName: season?.name ?? selectedSeasonId,
    })
  }, [selectedPlayer, selectedSeasonId, seasons, onConfirm])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Ver como jugador"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-gray-950/80 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-sm bg-gray-900 rounded-2xl shadow-xl flex flex-col gap-4 p-5 max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-slate-100 font-semibold text-base flex items-center gap-2">
            <Eye className="w-4 h-4 text-amber-400" />
            Ver como jugador
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <p role="alert" className="text-red-400 text-sm">{error}</p>
        )}

        {/* Season selector */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="vap-season" className="text-xs text-slate-400 font-medium uppercase tracking-wide">
            Temporada
          </label>
          {loadingSeasons ? (
            <div className="h-9 rounded-lg bg-gray-800 animate-pulse" />
          ) : (
            <select
              id="vap-season"
              value={selectedSeasonId}
              onChange={(e) => setSelectedSeasonId(e.target.value)}
              className="bg-gray-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              {seasons.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}
        </div>

        {/* Player search */}
        <div className="flex flex-col gap-1.5 min-h-0">
          <label htmlFor="vap-search" className="text-xs text-slate-400 font-medium uppercase tracking-wide">
            Jugador
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
            <input
              ref={searchRef}
              id="vap-search"
              type="text"
              placeholder="Buscar por nombre o nick…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-gray-800 border border-slate-700 text-slate-100 rounded-lg pl-8 pr-3 py-2 text-sm placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          {/* Player list */}
          <div className="overflow-y-auto flex-1 rounded-lg border border-slate-800 max-h-48">
            {loadingPlayers ? (
              <div className="flex items-center justify-center py-6 text-slate-500 text-sm">
                Cargando jugadores…
              </div>
            ) : filteredPlayers.length === 0 ? (
              <div className="flex items-center justify-center py-6 text-slate-500 text-sm">
                {players.length === 0 ? 'Sin jugadores en esta temporada' : 'Sin resultados'}
              </div>
            ) : (
              <ul role="listbox" aria-label="Jugadores" className="divide-y divide-slate-800/50">
                {filteredPlayers.map((p) => (
                  <li key={p.playerId}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selectedPlayer?.playerId === p.playerId}
                      onClick={() => setSelectedPlayer(p)}
                      className={[
                        'w-full text-left px-3 py-2.5 text-sm transition-colors',
                        selectedPlayer?.playerId === p.playerId
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'text-slate-300 hover:bg-slate-800',
                      ].join(' ')}
                    >
                      <span className="font-medium">{p.name}</span>
                      {p.nick && (
                        <span className="ml-1.5 text-slate-500 text-xs">@{p.nick}</span>
                      )}
                      {p.teamName && (
                        <span className="block text-xs text-slate-600 mt-0.5">{p.teamName}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 rounded-xl bg-gray-800 text-slate-300 text-sm font-medium hover:bg-gray-700 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!selectedPlayer}
            className="flex-1 py-2 rounded-xl bg-amber-500 text-gray-950 text-sm font-semibold hover:bg-amber-400 transition-colors disabled:opacity-40 disabled:pointer-events-none"
          >
            Ver como {selectedPlayer ? selectedPlayer.name.split(' ')[0] : '…'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function AdminViewAsBar() {
  const { isSuperAdmin, isImpersonating, impersonationTarget, startImpersonation, stopImpersonation } =
    usePlayerAuth()
  const [modalOpen, setModalOpen] = useState(false)

  if (!isSuperAdmin) return null

  const handleConfirm = (target) => {
    startImpersonation(target)
    setModalOpen(false)
  }

  if (isImpersonating && impersonationTarget) {
    return <ImpersonationBanner target={impersonationTarget} onExit={stopImpersonation} />
  }

  return (
    <>
      {/* Floating "View as" trigger — top-right corner */}
      <div className="fixed top-3 right-3 z-40">
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          aria-label="Abrir vista como jugador"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-semibold hover:bg-amber-500/30 transition-colors shadow"
        >
          <Eye className="w-3.5 h-3.5" />
          Ver como
        </button>
      </div>

      {modalOpen && (
        <ViewAsModal
          onConfirm={handleConfirm}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  )
}
