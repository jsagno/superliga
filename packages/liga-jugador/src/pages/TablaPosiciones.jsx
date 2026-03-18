import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Filter, RefreshCw } from 'lucide-react'
import BottomNav from '../components/BottomNav.jsx'
import StandingsRow from '../components/StandingsRow.jsx'
import { usePlayerAuth } from '../context/PlayerAuthContext.jsx'
import {
  fetchPlayerSeasonContext,
  fetchPlayerStandings,
  fetchSeasonZones,
  fetchSeasons,
} from '../services/standingsService.js'

const VIEW_TABS = [
  { key: 'ZONE', label: 'Zonas' },
  { key: 'A', label: 'Liga A' },
  { key: 'B', label: 'Liga B' },
]

function SeasonSelect({ seasons, selectedSeasonId, onChange }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
        Temporada
      </span>
      <select
        aria-label="Seleccionar temporada"
        className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-blue-500/60"
        value={selectedSeasonId}
        onChange={(event) => onChange(event.target.value)}
      >
        {seasons.map((season) => (
          <option key={season.seasonId} value={season.seasonId}>
            {season.description}
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

function ZoneChips({ zones, selectedZoneId, onSelect }) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => onSelect('ALL')}
        className={[
          'rounded-full border px-3 py-1.5 text-sm transition-colors',
          selectedZoneId === 'ALL'
            ? 'border-blue-500/40 bg-blue-500/10 text-blue-300'
            : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200',
        ].join(' ')}
      >
        Todas
      </button>
      {zones.map((zone) => (
        <button
          key={zone.zoneId}
          type="button"
          onClick={() => onSelect(zone.zoneId)}
          className={[
            'rounded-full border px-3 py-1.5 text-sm transition-colors',
            selectedZoneId === zone.zoneId
              ? 'border-blue-500/40 bg-blue-500/10 text-blue-300'
              : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200',
          ].join(' ')}
        >
          {zone.name}
        </button>
      ))}
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

function EmptyState({ activeTab, selectedZoneName }) {
  const message =
    activeTab === 'ZONE'
      ? selectedZoneName
        ? `No hay jugadores en ${selectedZoneName}`
        : 'No hay jugadores en esta zona'
      : 'No hay jugadores en esta liga'

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/70 px-5 py-10 text-center text-sm text-slate-400">
      {message}
    </div>
  )
}

export default function TablaPosiciones() {
  const { effectivePlayerId } = usePlayerAuth()
  const [seasons, setSeasons] = useState([])
  const [zones, setZones] = useState([])
  const [playerContext, setPlayerContext] = useState(null)
  const [standings, setStandings] = useState([])
  const [selectedSeasonId, setSelectedSeasonId] = useState('')
  const [activeTab, setActiveTab] = useState('ZONE')
  const [selectedZoneId, setSelectedZoneId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const currentRowRef = useRef(null)
  const listRef = useRef(null)

  useEffect(() => {
    let cancelled = false

    async function loadSeasons() {
      try {
        const seasonRows = await fetchSeasons()
        if (cancelled) return
        setSeasons(seasonRows)
        if (seasonRows.length > 0) {
          const defaultSeason = seasonRows.find((season) => season.status === 'ACTIVE') ?? seasonRows[0]
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

    setLoading(true)
    setError(false)

    try {
      const [zoneRows, context] = await Promise.all([
        fetchSeasonZones(selectedSeasonId),
        fetchPlayerSeasonContext(effectivePlayerId, selectedSeasonId),
      ])

      const validZoneIds = new Set(zoneRows.map((zone) => zone.zoneId))
      let effectiveZoneId = selectedZoneId

      if (activeTab === 'ZONE') {
        if (effectiveZoneId !== 'ALL' && !validZoneIds.has(effectiveZoneId)) {
          effectiveZoneId = context?.zoneId && validZoneIds.has(context.zoneId) ? context.zoneId : 'ALL'
        }

        if (!effectiveZoneId) {
          effectiveZoneId = context?.zoneId && validZoneIds.has(context.zoneId) ? context.zoneId : 'ALL'
        }
      }

      const rows = await fetchPlayerStandings(
        selectedSeasonId,
        activeTab === 'ZONE' && effectiveZoneId !== 'ALL' ? effectiveZoneId : undefined,
        activeTab === 'ZONE' ? 'ZONE' : 'LEAGUE',
        activeTab === 'ZONE' ? undefined : activeTab,
      )

      setZones(zoneRows)
      setPlayerContext(context)
      setStandings(rows)
      if (activeTab === 'ZONE' && effectiveZoneId && effectiveZoneId !== selectedZoneId) {
        setSelectedZoneId(effectiveZoneId)
      }
    } catch (loadError) {
      console.error('Failed to load standings:', loadError)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [activeTab, effectivePlayerId, selectedSeasonId, selectedZoneId])

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

  const selectedZoneName = useMemo(() => {
    if (selectedZoneId === 'ALL') return null
    return zones.find((zone) => zone.zoneId === selectedZoneId)?.name ?? null
  }, [selectedZoneId, zones])

  return (
    <div className="min-h-screen bg-gray-950 text-slate-200 pb-safe">
      <main className="mx-auto flex min-h-screen max-w-md flex-col px-4 pb-24 pt-4">
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

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-3 text-slate-400">
            <Filter className="h-5 w-5" strokeWidth={2} />
          </div>
        </header>

        <div className="space-y-4">
          <SeasonSelect
            seasons={seasons}
            selectedSeasonId={selectedSeasonId}
            onChange={(seasonId) => {
              setSelectedSeasonId(seasonId)
              setSelectedZoneId('')
            }}
          />

          <ViewTabs activeTab={activeTab} onChange={setActiveTab} />

          {activeTab === 'ZONE' && (
            <ZoneChips zones={zones} selectedZoneId={selectedZoneId} onSelect={setSelectedZoneId} />
          )}

          {playerContext && (
            <div className="rounded-3xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-sm text-slate-300">
              <span className="font-semibold text-slate-100">Tu contexto actual:</span>{' '}
              {playerContext.zoneName ?? 'Zona'} · Liga {playerContext.league ?? '-'}
            </div>
          )}

          <section>
            <div className="mb-3 flex items-center justify-between text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
              <span>
                {activeTab === 'ZONE'
                  ? selectedZoneName ?? 'Todas las zonas'
                  : `Liga ${activeTab}`}
              </span>
              <span>{standings.length} jugadores</span>
            </div>

            {loading ? (
              <LoadingState />
            ) : error ? (
              <ErrorState onRetry={loadStandings} />
            ) : standings.length === 0 ? (
              <EmptyState activeTab={activeTab} selectedZoneName={selectedZoneName} />
            ) : (
              <div
                ref={listRef}
                data-testid="standings-list"
                className="max-h-[58vh] space-y-3 overflow-y-auto pr-1"
              >
                {standings.map((row) => {
                  const isCurrentPlayer = row.playerId === effectivePlayerId
                  return (
                    <StandingsRow
                      key={`${row.playerId}-${row.zoneId}-${row.position}`}
                      row={row}
                      isCurrentPlayer={isCurrentPlayer}
                      showZone={activeTab === 'ZONE' && selectedZoneId === 'ALL'}
                      rowRef={isCurrentPlayer ? currentRowRef : null}
                    />
                  )
                })}
              </div>
            )}
          </section>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
