import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Crown, Minus, TrendingDown, TrendingUp, Users } from 'lucide-react'
import BottomNav from '../components/BottomNav.jsx'
import MobileProtectedLayout from '../components/MobileProtectedLayout.jsx'
import TeamStandingsRow from '../components/TeamStandingsRow.jsx'
import { usePlayerAuth } from '../context/PlayerAuthContext.jsx'
import {
  fetchPlayerSeasonContext,
  fetchSeasonZones,
  fetchSeasons,
  fetchTeamStandings,
} from '../services/standingsService.js'

function getTrend(deltaPosition) {
  if (deltaPosition > 0) {
    return { Icon: TrendingUp, className: 'text-emerald-400' }
  }

  if (deltaPosition < 0) {
    return { Icon: TrendingDown, className: 'text-rose-400' }
  }

  return { Icon: Minus, className: 'text-slate-500' }
}

function ZoneTabs({ zones, selectedZoneId, onSelect }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {zones.map((zone) => {
        const isActive = zone.zoneId === selectedZoneId
        return (
          <button
            key={zone.zoneId}
            type="button"
            onClick={() => onSelect(zone.zoneId)}
            className={[
              'whitespace-nowrap rounded-full border px-3 py-1.5 text-sm transition-colors',
              isActive
                ? 'border-blue-500/40 bg-blue-500/10 text-blue-300'
                : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200',
            ].join(' ')}
          >
            {zone.name}
          </button>
        )
      })}
    </div>
  )
}

function PodiumCard({ row, variant = 'default', isCurrentTeam = false }) {
  if (!row) {
    return <div className="h-36 flex-1 rounded-3xl border border-dashed border-slate-800 bg-slate-900/40" />
  }

  const trend = getTrend(row.deltaPosition)
  const heightClass = variant === 'winner' ? 'h-44' : 'h-32'

  return (
    <div
      data-current-team={isCurrentTeam ? 'true' : 'false'}
      className={[
        'flex flex-1 flex-col justify-end rounded-3xl border px-4 py-4 text-center',
        heightClass,
        isCurrentTeam ? 'border-blue-500/40 bg-blue-500/10' : 'border-slate-800 bg-slate-900/70',
      ].join(' ')}
    >
      <div className="mb-3 flex justify-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-800 text-lg font-bold text-slate-100 ring-1 ring-slate-700">
          {(row.name ?? 'E').charAt(0).toUpperCase()}
        </div>
      </div>

      <div className="flex items-center justify-center gap-1 text-xs text-slate-400">
        <trend.Icon className={`h-4 w-4 ${trend.className}`} strokeWidth={2} />
        <span>#{row.position}</span>
      </div>

      <p className="mt-2 truncate text-sm font-semibold text-slate-100">{row.name}</p>
      <p className="mt-1 text-xl font-bold text-slate-50">{row.pointsTotal}</p>
      <p className="text-xs text-slate-500">puntos</p>

      {variant === 'winner' && (
        <div className="mt-3 flex justify-center text-amber-300">
          <Crown className="h-5 w-5" strokeWidth={2} />
        </div>
      )}
    </div>
  )
}

function LoadingState() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-36 animate-pulse rounded-3xl border border-slate-800 bg-slate-900" />
        ))}
      </div>
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="h-16 animate-pulse rounded-2xl border border-slate-800 bg-slate-900" />
      ))}
    </div>
  )
}

export default function TablaEquipos() {
  const { effectivePlayerId } = usePlayerAuth()
  const [selectedSeason, setSelectedSeason] = useState(null)
  const [zones, setZones] = useState([])
  const [selectedZoneId, setSelectedZoneId] = useState('')
  const [playerContext, setPlayerContext] = useState(null)
  const [teamStandings, setTeamStandings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function bootstrap() {
      try {
        const seasons = await fetchSeasons()
        if (cancelled) return
        const activeSeason = seasons.find((season) => season.status === 'ACTIVE') ?? seasons[0] ?? null
        setSelectedSeason(activeSeason)
      } catch (loadError) {
        console.error('Failed to bootstrap team standings:', loadError)
        if (!cancelled) {
          setError(true)
          setLoading(false)
        }
      }
    }

    bootstrap()

    return () => {
      cancelled = true
    }
  }, [])

  const loadStandings = useCallback(async () => {
    if (!effectivePlayerId || !selectedSeason?.seasonId) return

    setLoading(true)
    setError(false)

    try {
      const [zoneRows, context] = await Promise.all([
        fetchSeasonZones(selectedSeason.seasonId),
        fetchPlayerSeasonContext(effectivePlayerId, selectedSeason.seasonId),
      ])

      const zoneId =
        selectedZoneId ||
        (context?.zoneId && zoneRows.some((zone) => zone.zoneId === context.zoneId)
          ? context.zoneId
          : zoneRows[0]?.zoneId)

      const rows = zoneId ? await fetchTeamStandings(selectedSeason.seasonId, zoneId) : []

      setZones(zoneRows)
      setPlayerContext(context)
      setSelectedZoneId(zoneId ?? '')
      setTeamStandings(rows)
    } catch (loadError) {
      console.error('Failed to load team standings:', loadError)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [effectivePlayerId, selectedSeason, selectedZoneId])

  useEffect(() => {
    loadStandings()
  }, [loadStandings])

  const podiumRows = useMemo(() => {
    const second = teamStandings.find((row) => row.position === 2) ?? teamStandings[1] ?? null
    const first = teamStandings.find((row) => row.position === 1) ?? teamStandings[0] ?? null
    const third = teamStandings.find((row) => row.position === 3) ?? teamStandings[2] ?? null
    return { second, first, third }
  }, [teamStandings])

  const currentTeamId = playerContext?.teamId ?? null
  const selectedZoneName = zones.find((zone) => zone.zoneId === selectedZoneId)?.name ?? 'Zona'

  return (
    <MobileProtectedLayout nav={<BottomNav />}>
      <div className="flex min-h-0 flex-1 flex-col" data-testid="tabla-equipos-scroll-root">
        <header className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
              Liga Interna
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-50">Tabla de Equipos</h1>
            <p className="mt-1 text-sm text-slate-400">
              {selectedSeason?.description ?? 'Temporada'} · {selectedZoneName}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-3 text-slate-400">
            <Users className="h-5 w-5" strokeWidth={2} />
          </div>
        </header>

        <div data-testid="tabla-equipos-scroll-content" className="min-h-0 flex-1 space-y-4 overflow-y-auto pb-2">
          <ZoneTabs zones={zones} selectedZoneId={selectedZoneId} onSelect={setSelectedZoneId} />

          {loading ? (
            <LoadingState />
          ) : error ? (
            <div className="rounded-3xl border border-rose-500/20 bg-rose-500/5 px-5 py-8 text-center">
              <p className="text-base font-semibold text-slate-100">No se pudo cargar la tabla de equipos</p>
              <button
                type="button"
                onClick={loadStandings}
                className="mt-4 rounded-xl bg-blue-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-400"
              >
                Reintentar
              </button>
            </div>
          ) : (
            <>
              <section className="rounded-3xl border border-slate-800 bg-slate-900/70 px-4 py-5">
                <div className="mb-4 text-center">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                    Lideres de temporada
                  </p>
                  <p className="mt-1 text-sm text-slate-400">{selectedSeason?.description ?? 'Temporada'}</p>
                </div>

                <div className="grid grid-cols-3 items-end gap-3">
                  <PodiumCard
                    row={podiumRows.second}
                    isCurrentTeam={podiumRows.second?.teamId === currentTeamId}
                  />
                  <PodiumCard
                    row={podiumRows.first}
                    variant="winner"
                    isCurrentTeam={podiumRows.first?.teamId === currentTeamId}
                  />
                  <PodiumCard
                    row={podiumRows.third}
                    isCurrentTeam={podiumRows.third?.teamId === currentTeamId}
                  />
                </div>
              </section>

              <section>
                <div className="mb-3 flex items-center justify-between text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                  <span>Clasificacion general</span>
                  <span>{teamStandings.length} equipos</span>
                </div>

                {teamStandings.length === 0 ? (
                  <div className="rounded-3xl border border-slate-800 bg-slate-900/70 px-5 py-10 text-center text-sm text-slate-400">
                    No hay equipos cargados para esta zona.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {teamStandings.map((row) => (
                      <TeamStandingsRow
                        key={row.teamId}
                        row={row}
                        isCurrentTeam={row.teamId === currentTeamId}
                      />
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </MobileProtectedLayout>
  )
}
