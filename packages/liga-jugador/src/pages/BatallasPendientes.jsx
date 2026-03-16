import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Bell, LayoutGrid, RefreshCw, Swords, Trophy } from 'lucide-react'
import BottomNav from '../components/BottomNav.jsx'
import PendingBattleCard from '../components/PendingBattleCard.jsx'
import VincularBatallaPanel from '../components/VincularBatallaPanel.jsx'
import { usePlayerAuth } from '../context/PlayerAuthContext.jsx'
import {
  fetchPendingMatches,
  fetchPendingMatchesCount,
} from '../services/scheduledMatchesService.js'

const FILTER_TABS = [
  { key: 'ALL', label: 'Todas', icon: null },
  { key: 'CUP', label: 'Copa de Liga', icon: Trophy },
  { key: 'DAILY', label: 'Duelo Diario', icon: Swords },
]

export default function BatallasPendientes() {
  const { playerId, appUserId } = usePlayerAuth()
  const [activeFilter, setActiveFilter] = useState('ALL')
  const [matches, setMatches] = useState([])
  const [pendingCount, setPendingCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [selectedMatch, setSelectedMatch] = useState(null)
  const [toast, setToast] = useState(null)

  const load = useCallback(async () => {
    if (!playerId) return
    setLoading(true)
    setError(false)

    try {
      const [rows, count] = await Promise.all([
        fetchPendingMatches(playerId, activeFilter),
        fetchPendingMatchesCount(playerId),
      ])
      setMatches(rows)
      setPendingCount(count)
    } catch (loadError) {
      console.error('Failed to load pending matches:', loadError)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [activeFilter, playerId])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 2500)
    return () => clearTimeout(id)
  }, [toast])

  const titleByFilter = useMemo(() => {
    if (activeFilter === 'CUP') return 'Copa de Liga'
    if (activeFilter === 'DAILY') return 'Duelo Diario'
    return 'Todas las batallas'
  }, [activeFilter])

  function handleLinked(payload) {
    setMatches((prev) => prev.filter((m) => m.scheduledMatchId !== payload.scheduledMatchId))
    setPendingCount((prev) => Math.max(0, prev - 1))
    setToast('Batalla vinculada correctamente')
  }

  function handleReport() {
    setToast('Reporte disponible en proxima fase')
  }

  return (
    <div className="min-h-screen bg-gray-950 text-slate-200 pb-safe">
      <main className="mx-auto flex min-h-screen max-w-md flex-col px-4 pb-24 pt-4">
        <header className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Liga Interna</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-50">Batallas Pendientes</h1>
            <p className="mt-1 text-sm text-slate-400">{titleByFilter} · {pendingCount} pendientes</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              aria-label="Notificaciones"
              type="button"
              className="rounded-2xl border border-slate-800 bg-slate-900 p-3 text-slate-400"
            >
              <Bell className="h-5 w-5" strokeWidth={2} />
            </button>
            <button
              aria-label="Cambiar vista"
              type="button"
              className="rounded-2xl border border-slate-800 bg-slate-900 p-3 text-slate-400"
            >
              <LayoutGrid className="h-5 w-5" strokeWidth={2} />
            </button>
          </div>
        </header>

        <section className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {FILTER_TABS.map((tab) => {
            const TabIcon = tab.icon
            const isActive = tab.key === activeFilter

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveFilter(tab.key)}
                className={[
                  'whitespace-nowrap rounded-full border px-3 py-1.5 text-sm transition-colors flex items-center gap-1.5',
                  isActive
                    ? 'border-blue-500/40 bg-blue-500/10 text-blue-300'
                    : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200',
                ].join(' ')}
              >
                {TabIcon && <TabIcon className="w-3.5 h-3.5" strokeWidth={2} />}
                <span>{tab.label}</span>
              </button>
            )
          })}
        </section>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="h-24 animate-pulse rounded-2xl border border-slate-800 bg-slate-900" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-3xl border border-rose-500/20 bg-rose-500/5 px-5 py-8 text-center">
            <p className="text-base font-semibold text-slate-100">No se pudo cargar la lista</p>
            <p className="mt-2 text-sm text-slate-400">Verifica tu conexion e intenta nuevamente.</p>
            <button
              type="button"
              onClick={load}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-400"
            >
              <RefreshCw className="h-4 w-4" strokeWidth={2} />
              Reintentar
            </button>
          </div>
        ) : matches.length === 0 ? (
          <div className="rounded-3xl border border-slate-800 bg-slate-900/70 px-5 py-10 text-center text-sm text-slate-400">
            No tienes batallas pendientes 🎉
          </div>
        ) : (
          <div className="space-y-3">
            {matches.map((match) => (
              <PendingBattleCard
                key={match.scheduledMatchId}
                match={match}
                onLink={() => setSelectedMatch(match)}
                onReport={handleReport}
              />
            ))}
          </div>
        )}
      </main>

      {toast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[80] rounded-xl bg-emerald-600 text-white text-sm px-4 py-2 shadow-lg" role="status">
          {toast}
        </div>
      )}

      <VincularBatallaPanel
        open={Boolean(selectedMatch)}
        onClose={() => setSelectedMatch(null)}
        matchContext={selectedMatch}
        appUserId={appUserId}
        onLinked={handleLinked}
      />

      <BottomNav pendingCount={pendingCount} />
    </div>
  )
}
