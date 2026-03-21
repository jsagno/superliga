import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Filter, RefreshCw } from 'lucide-react'
import BottomNav from '../components/BottomNav.jsx'
import MobileProtectedLayout from '../components/MobileProtectedLayout.jsx'
import StandingsRow from '../components/StandingsRow.jsx'
import { usePlayerAuth } from '../context/PlayerAuthContext.jsx'
import {
  fetchPlayerSeasonContext,
  fetchPlayerStandings,
  fetchSeasonZones,
  fetchSeasons,
} from '../services/standingsService.js'

const VIEW_TABS = [
  { key: 'A', label: 'Liga A' },
  { key: 'B', label: 'Liga B' },
  { key: 'C', label: 'Liga C' },
]

function ZoneSelect({ zones, selectedZoneId, onChange }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
        Zona
      </span>
      <select
        aria-label="Seleccionar zona"
        className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-blue-500/60"
        value={selectedZoneId}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Selecciona una zona</option>
        {zones.map((zone) => (
          <option key={zone.zoneId} value={zone.zoneId}>
            {zone.name}
          </option>
        ))}
      </select>
    </label>
  )
}

function ViewTabs({ activeTab, onChange }) {
  return (
    <div className="grid grid-cols-3 gap-2 rounded-2xl border border-slate-800 bg-slate-900 p-1">
      {VIEW_TABS.map((tab) => {
        const isActive = activeTab === tab.key
        return (
          <button
            key={tab.key}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(tab.key)}
            className={[
              'rounded-xl px-3 py-2 text-sm font-semibold transition-colors',
              isActive ? 'bg-blue-500 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200',
            ].join(' ')}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

function LoadingState() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="animate-pulse rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-slate-800" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-40 rounded bg-slate-800" />
              <div className="h-3 w-28 rounded bg-slate-800" />
            </div>
            <div className="h-5 w-10 rounded bg-slate-800" />
          </div>
        </div>
      ))}
    </div>
  )
}

function ErrorState({ onRetry }) {
  return (
    <div className="rounded-3xl border border-rose-500/20 bg-rose-500/5 px-5 py-8 text-center">
      <p className="text-base font-semibold text-slate-100">No se pudo cargar la tabla</p>
      <p className="mt-2 text-sm text-slate-400">
        Hubo un problema al leer las posiciones. Intenta nuevamente.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-400"
      >
        <RefreshCw className="h-4 w-4" strokeWidth={2} />
        Reintentar
      </button>
    </div>
  )
}

function EmptyState() {
  const message = 'No hay jugadores en esta liga'

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/70 px-5 py-10 text-center text-sm text-slate-400">
      {message}
    </div>
  )
}

function formatDateTime(isoStr) {
  if (!isoStr) return null
  const d = new Date(isoStr)
  const local = new Date(d.getTime() - 3 * 60 * 60 * 1000)
  const dd = String(local.getUTCDate()).padStart(2, '0')
  const mm = String(local.getUTCMonth() + 1).padStart(2, '0')
  const yyyy = local.getUTCFullYear()
  const hh = String(local.getUTCHours()).padStart(2, '0')
  const min = String(local.getUTCMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${yyyy} ${hh}:${min} (GMT-3)`
}

export default function TablaPosiciones() {
  const { effectivePlayerId } = usePlayerAuth()
  const [seasons, setSeasons] = useState([])
  const [zones, setZones] = useState([])
  const [standings, setStandings] = useState([])
  const [selectedSeasonId, setSelectedSeasonId] = useState('')
  const [selectedZoneId, setSelectedZoneId] = useState('')
  const [activeTab, setActiveTab] = useState('A')
  const [tabSetByLeague, setTabSetByLeague] = useState(false)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const currentRowRef = useRef(null)
  const listRef = useRef(null)
  const latestRequestRef = useRef(0)

  useEffect(() => {
    let cancelled = false

    async function loadSeasons() {
      try {
        const seasonRows = await fetchSeasons()
        if (cancelled) return
        setSeasons(seasonRows)
        if (seasonRows.length > 0) {
          const activeSeason = seasonRows.find((season) => season.status === 'ACTIVE')
          const previousSeason = seasonRows.find((season) => season.status !== 'ACTIVE')
          const defaultSeason = activeSeason ?? previousSeason ?? seasonRows[0]
          setSelectedSeasonId(defaultSeason.seasonId)
        }
      } catch (loadError) {
        console.error('Failed to load seasons:', loadError)
        if (!cancelled) {
          setError(true)
          setLoading(false)
        }
      }
    }

    loadSeasons()

    return () => {
      cancelled = true
    }
  }, [])

  const loadStandings = useCallback(async () => {
    if (!effectivePlayerId || !selectedSeasonId) return

    const requestId = latestRequestRef.current + 1
    latestRequestRef.current = requestId

    setLoading(true)
    setError(false)

    try {
      const [zoneRows, context] = await Promise.all([
        fetchSeasonZones(selectedSeasonId),
        fetchPlayerSeasonContext(effectivePlayerId, selectedSeasonId),
      ])

      if (latestRequestRef.current !== requestId) return

      setZones(zoneRows)
      let effectiveZoneId = selectedZoneId
      if (!effectiveZoneId && context?.zoneId) {
        effectiveZoneId = context.zoneId
        setSelectedZoneId(effectiveZoneId)
      }

      let effectiveLeague = activeTab
      if (!tabSetByLeague && (context?.league === 'A' || context?.league === 'B' || context?.league === 'C')) {
        effectiveLeague = context.league
        setTabSetByLeague(true)
        if (context.league !== activeTab) {
          setActiveTab(context.league)
        }
      }

      const rows = await fetchPlayerStandings(
        selectedSeasonId,
        effectiveZoneId,
        'LEAGUE',
        effectiveLeague,
      )

      if (latestRequestRef.current !== requestId) return

      setStandings(rows)
    } catch (loadError) {
      if (latestRequestRef.current !== requestId) return
      console.error('Failed to load standings:', loadError)
      setError(true)
    } finally {
      if (latestRequestRef.current === requestId) {
        setLoading(false)
      }
    }
  }, [activeTab, effectivePlayerId, selectedSeasonId, selectedZoneId, tabSetByLeague])

  useEffect(() => {
    loadStandings()
  }, [loadStandings])

  useEffect(() => {
    if (!currentRowRef.current) return
    currentRowRef.current.scrollIntoView({ block: 'center', behavior: 'auto' })
  }, [standings, activeTab, selectedSeasonId, selectedZoneId])

  const selectedSeason = useMemo(
    () => seasons.find((season) => season.seasonId === selectedSeasonId) ?? null,
    [seasons, selectedSeasonId],
  )

  const lastUpdated = useMemo(() => {
    const zoneId = selectedZoneId
    return zones.find((z) => z.zoneId === zoneId)?.lastSnapshotAt ?? null
  }, [zones, selectedZoneId])

  return (
    <MobileProtectedLayout nav={<BottomNav />}>
      <div className="flex min-h-0 flex-1 flex-col" data-testid="tabla-page-scroll-root">
        <header className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
              Liga Interna
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-50">Tablas de Posiciones</h1>
            <p className="mt-1 text-sm text-slate-400">
              {selectedSeason?.description ?? 'Temporada'}
            </p>
          </div>

          <button
            type="button"
            aria-label="Abrir filtros"
            onClick={() => setIsFilterOpen(true)}
            className="rounded-2xl border border-slate-800 bg-slate-900 p-3 text-slate-400 transition hover:border-slate-700 hover:text-slate-300"
          >
            <Filter className="h-5 w-5" strokeWidth={2} />
          </button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <section className="flex min-h-0 flex-1 flex-col">
            <div className="mb-3 flex items-center justify-between text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
              <span>Liga {activeTab}</span>
              <span>{standings.length} jugadores</span>
              {lastUpdated && (
                <span className="text-xs text-slate-600 normal-case tracking-normal">
                  Actualizado: {formatDateTime(lastUpdated)}
                </span>
              )}
            </div>

            {loading ? (
              <LoadingState />
            ) : error ? (
              <ErrorState onRetry={loadStandings} />
            ) : standings.length === 0 ? (
              <EmptyState />
            ) : (
              <div
                ref={listRef}
                data-testid="standings-list"
                className="min-h-0 flex-1 rounded-2xl border border-slate-800 overflow-y-auto overflow-x-hidden"
              >
                <table className="w-full table-fixed text-xs sm:text-sm">
                  <colgroup>
                    <col className="w-[10%]" />
                    <col className="w-[34%]" />
                    <col className="w-[7%]" />
                    <col className="w-[7%]" />
                    <col className="w-[7%]" />
                    <col className="w-[7%]" />
                    <col className="w-[11%]" />
                    <col className="w-[8%]" />
                    <col className="w-[9%]" />
                  </colgroup>
                  <thead className="sticky top-0 bg-slate-900/95 border-b border-slate-800">
                    <tr className="text-slate-400 text-xs">
                      <th className="px-1.5 py-2 text-center sm:px-3 sm:py-3">RNK</th>
                      <th className="px-1.5 py-2 text-left sm:px-3 sm:py-3">Jugador</th>
                      <th className="px-1.5 py-2 text-center text-[10px] sm:px-3 sm:py-3 sm:text-[11px]" title="Puntos iniciales (handicap)">AN</th>
                      <th className="px-1.5 py-2 text-center text-[10px] sm:px-3 sm:py-3 sm:text-[11px]" title="Bonificaciones manuales">AC</th>
                      <th className="px-1.5 py-2 text-center text-[10px] sm:px-3 sm:py-3 sm:text-[11px]" title="Duelos">⚔️</th>
                      <th className="px-1.5 py-2 text-center text-[10px] sm:px-3 sm:py-3 sm:text-[11px]" title="Copa">🏆</th>
                      <th className="px-1.5 py-2 text-center text-[10px] font-bold sm:px-3 sm:py-3 sm:text-[11px]">TOTAL</th>
                      <th className="px-1.5 py-2 text-center text-[10px] sm:px-3 sm:py-3 sm:text-[11px]">G</th>
                      <th className="px-1.5 py-2 text-center text-[10px] sm:px-3 sm:py-3 sm:text-[11px]">P</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map((row) => {
                      const isCurrentPlayer = row.playerId === effectivePlayerId
                      return (
                        <StandingsRow
                          key={`${row.playerId}-${row.zoneId}-${row.position}`}
                          row={row}
                          isCurrentPlayer={isCurrentPlayer}
                          showZone={false}
                          rowRef={isCurrentPlayer ? currentRowRef : null}
                        />
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        {isFilterOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/60 px-4 py-8"
            role="dialog"
            aria-modal="true"
            aria-label="Filtros de tabla"
            onClick={() => setIsFilterOpen(false)}
          >
            <div
              className="mx-auto max-w-md rounded-3xl border border-slate-800 bg-slate-950 p-4"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-300">Filtros</p>
                <button
                  type="button"
                  onClick={() => setIsFilterOpen(false)}
                  className="rounded-xl border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-slate-600 hover:text-slate-100"
                >
                  Cerrar
                </button>
              </div>

              <div className="space-y-4">
                {zones.length > 0 && (
                  <ZoneSelect zones={zones} selectedZoneId={selectedZoneId} onChange={setSelectedZoneId} />
                )}
                <ViewTabs activeTab={activeTab} onChange={setActiveTab} />
              </div>
            </div>
          </div>
        )}
      </div>
    </MobileProtectedLayout>
  )
}
