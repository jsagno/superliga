import React, { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronDown, Swords, Trophy, Shield } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav.jsx'
import BattleCard from '../components/BattleCard.jsx'
import BattleDetailModal from '../components/BattleDetailModal.jsx'
import { usePlayerAuth } from '../context/PlayerAuthContext.jsx'
import {
  fetchPlayerBattleHistory,
  fetchPlayerGlobalStats,
} from '../services/battlesService.js'
import { supabase } from '../supabaseClient.js'

const TYPE_TABS = [
  { key: 'ALL', label: 'Todos', icon: null },
  { key: 'CW_DAILY', label: 'Duelo de Guerra', icon: Swords },
  { key: 'CUP_MATCH', label: 'Copa de Liga', icon: Trophy },
  { key: 'REVENGE', label: 'Copa Revenge', icon: Shield },
]

const PAGE_SIZE = 20

const IS_E2E = import.meta.env.VITE_E2E_AUTH_BYPASS === 'true'
const E2E_SEASON_ID = 'season-e2e-001'

async function fetchSeasons() {
  if (IS_E2E) {
    return [{ season_id: E2E_SEASON_ID, description: 'Temporada E2E', status: 'ACTIVE' }]
  }
  const { data, error } = await supabase
    .from('season')
    .select('season_id, description, status')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}
export default function HistorialBatallas() {
  const { playerId } = usePlayerAuth()
  const navigate = useNavigate()

  const [seasons, setSeasons] = useState([])
  const [selectedSeasonId, setSelectedSeasonId] = useState(null)
  const [seasonDropdownOpen, setSeasonDropdownOpen] = useState(false)
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [items, setItems] = useState([])
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(false)
  const [stats, setStats] = useState(null)
  const [detailBattleId, setDetailBattleId] = useState(null)
  const sentinelRef = useRef(null)

  // Load seasons on mount
  useEffect(() => {
    fetchSeasons()
      .then((list) => {
        setSeasons(list)
        const active = list.find((s) => s.status === 'ACTIVE') ?? list[0] ?? null
        setSelectedSeasonId(active?.season_id ?? null)
      })
      .catch(console.error)
  }, [])

  // Load page 0 when season/filter changes
  const loadHistory = useCallback(async () => {
    if (!playerId || !selectedSeasonId) return
    setLoading(true)
    setError(false)
    setPage(0)

    try {
      const [historyResult, statsResult] = await Promise.all([
        fetchPlayerBattleHistory(playerId, selectedSeasonId, { typeFilter, page: 0, limit: PAGE_SIZE }),
        fetchPlayerGlobalStats(playerId, selectedSeasonId),
      ])
      setItems(historyResult.items)
      setHasMore(historyResult.hasMore)
      setStats(statsResult)
    } catch (err) {
      console.error('HistorialBatallas load error:', err)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [playerId, selectedSeasonId, typeFilter])

  useEffect(() => { loadHistory() }, [loadHistory])

  // Load next page
  const loadMore = useCallback(async () => {
    if (!playerId || !selectedSeasonId || loadingMore || !hasMore) return
    setLoadingMore(true)
    const nextPage = page + 1
    try {
      const result = await fetchPlayerBattleHistory(playerId, selectedSeasonId, {
        typeFilter,
        page: nextPage,
        limit: PAGE_SIZE,
      })
      setItems((prev) => [...prev, ...result.items])
      setHasMore(result.hasMore)
      setPage(nextPage)
    } catch (err) {
      console.error('loadMore error:', err)
    } finally {
      setLoadingMore(false)
    }
  }, [playerId, selectedSeasonId, typeFilter, page, hasMore, loadingMore])

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && hasMore && !loadingMore && !loading) loadMore() },
      { threshold: 0.1 },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, loadingMore, loading, loadMore])

  const selectedSeason = seasons.find((s) => s.season_id === selectedSeasonId)

  return (
    <div className="min-h-screen bg-gray-950 text-slate-200 pb-safe">
      <main className="mx-auto flex min-h-screen max-w-md flex-col px-4 pb-24 pt-4">

        {/* Header */}
        <header className="mb-5 flex items-center gap-3">
          <button
            type="button"
            aria-label="Volver al dashboard"
            onClick={() => navigate('/dashboard')}
            className="w-9 h-9 rounded-xl border border-slate-800 bg-slate-900 flex items-center justify-center text-slate-400 hover:text-slate-200 shrink-0"
          >
            <ChevronLeft className="w-5 h-5" strokeWidth={2} />
          </button>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Liga Interna</p>
            <h1 className="text-2xl font-bold text-slate-50">Histórico</h1>
          </div>
        </header>

        {/* Season selector */}
        <div className="relative mb-4">
          <button
            type="button"
            onClick={() => setSeasonDropdownOpen((v) => !v)}
            className="w-full flex items-center justify-between gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-slate-200 hover:border-slate-600"
          >
            <span className="truncate">
              {selectedSeason
                ? `${selectedSeason.description ?? 'Temporada'}${selectedSeason.status === 'ACTIVE' ? ' · Activa' : ''}`
                : 'Seleccionar temporada'}
            </span>
            <ChevronDown className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ${seasonDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {seasonDropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 z-10 rounded-xl border border-slate-700 bg-slate-900 shadow-xl overflow-hidden">
              {seasons.map((s) => (
                <button
                  key={s.season_id}
                  type="button"
                  onClick={() => { setSelectedSeasonId(s.season_id); setSeasonDropdownOpen(false) }}
                  className={[
                    'w-full text-left px-4 py-2.5 text-sm hover:bg-slate-800 transition-colors',
                    s.season_id === selectedSeasonId ? 'text-blue-300' : 'text-slate-300',
                  ].join(' ')}
                >
                  {s.description ?? 'Temporada'}
                  {s.status === 'ACTIVE' && <span className="ml-2 text-xs text-emerald-400">· Activa</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Stats badges */}
        {stats && (
          <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
            {[
              { label: 'Victorias', value: stats.wins, color: 'text-emerald-300' },
              { label: 'Batallas', value: stats.total, color: 'text-slate-200' },
              { label: 'Win Rate', value: `${stats.winRate}%`, color: 'text-blue-300' },
            ].map(({ label, value, color }) => (
              <div key={label} className="shrink-0 rounded-xl border border-slate-700/60 bg-slate-800/60 px-4 py-2 text-center">
                <p className={`text-lg font-bold ${color}`}>{value}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Type tabs */}
        <section className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {TYPE_TABS.map((tab) => {
            const TabIcon = tab.icon
            const isActive = tab.key === typeFilter
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setTypeFilter(tab.key)}
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

        {/* Battle list */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl border border-slate-800 bg-slate-900" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-3xl border border-rose-500/20 bg-rose-500/5 px-5 py-8 text-center">
            <p className="text-base font-semibold text-slate-100">No se pudo cargar el histórico</p>
            <p className="mt-2 text-sm text-slate-400">Verifica tu conexión e intenta de nuevo.</p>
            <button
              type="button"
              onClick={loadHistory}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-400"
            >
              Reintentar
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-3xl border border-slate-700/40 bg-slate-800/20 px-5 py-10 text-center">
            <p className="text-5xl mb-3">🗡️</p>
            <p className="text-base font-semibold text-slate-200">Sin batallas registradas</p>
            <p className="mt-1 text-sm text-slate-400">
              {typeFilter === 'ALL'
                ? 'No hay batallas vinculadas en esta temporada.'
                : 'No hay batallas de este tipo en la temporada seleccionada.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <BattleCard
                key={item.scheduledMatchId}
                item={item}
                onViewDetail={(battleId) => setDetailBattleId(battleId)}
              />
            ))}

            <div ref={sentinelRef} />

            {loadingMore && (
              <p className="py-4 text-center text-sm text-slate-500">Cargando más batallas…</p>
            )}

            {!hasMore && items.length > 0 && (
              <p className="py-4 text-center text-xs text-slate-600">
                — {items.length} batalla{items.length === 1 ? '' : 's'} en total —
              </p>
            )}
          </div>
        )}
      </main>

      <BottomNav />

      {detailBattleId && (
        <BattleDetailModal
          battleId={detailBattleId}
          onClose={() => setDetailBattleId(null)}
        />
      )}
    </div>
  )
}
