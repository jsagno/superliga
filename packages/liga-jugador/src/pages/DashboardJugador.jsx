// SPEC: docs/openspec/changes/liga-jugador/specs/dashboard-jugador.md
// RF-DASH-01 through RF-DASH-06

import React, { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Bell, RefreshCw, Swords } from 'lucide-react'

import { usePlayerAuth } from '../context/PlayerAuthContext.jsx'
import BottomNav from '../components/BottomNav.jsx'
import StatsBadge from '../components/StatsBadge.jsx'
import PendingBattleCard from '../components/PendingBattleCard.jsx'
import {
  fetchPlayerProfile,
  fetchPlayerStats,
  fetchPendingMatchesSummary,
} from '../services/dashboardService.js'

// ── Constants ────────────────────────────────────────────────────────────────
const TOTAL_BATTLES = 20

// ── Helpers ──────────────────────────────────────────────────────────────────
function daysUntil(isoDate) {
  if (!isoDate) return null
  const diff = new Date(isoDate).getTime() - Date.now()
  if (diff <= 0) return 0
  return Math.ceil(diff / 86_400_000)
}

// ── useDashboard hook ─────────────────────────────────────────────────────────
function useDashboard(playerId) {
  const [profile, setProfile] = useState(null)
  const [stats, setStats] = useState(null)
  const [pendingMatches, setPendingMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!playerId) return
    setLoading(true)
    setError(null)
    try {
      const prof = await fetchPlayerProfile(playerId)
      setProfile(prof)

      if (prof?.seasonId) {
        const [st, pm] = await Promise.all([
          fetchPlayerStats(playerId, prof.seasonId, prof.zoneId, prof.league),
          fetchPendingMatchesSummary(playerId),
        ])
        setStats(st)
        setPendingMatches(pm)
      } else {
        setStats(null)
        setPendingMatches([])
      }
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [playerId])

  useEffect(() => {
    load()
  }, [load])

  return { profile, stats, pendingMatches, loading, error, retry: load }
}

// ── Skeleton helpers ──────────────────────────────────────────────────────────
function SkeletonLine({ w = 'w-full', h = 'h-4' }) {
  return <div className={`${w} ${h} rounded-md bg-slate-700/60 animate-pulse`} />
}

function SkeletonCard() {
  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl px-4 py-3 space-y-2">
      <SkeletonLine w="w-1/2" />
      <SkeletonLine w="w-3/4" h="h-3" />
    </div>
  )
}

// ── Sub-sections ──────────────────────────────────────────────────────────────
function Header({ name }) {
  return (
    <header className="flex items-start justify-between gap-3 pt-2 pb-1">
      <div className="min-w-0">
        <p className="text-xs text-slate-400 uppercase tracking-widest font-medium">Liga Interna</p>
        <h1 className="text-xl font-bold text-slate-100 leading-tight mt-0.5 truncate">
          Bienvenido, {name}
        </h1>
      </div>
      {/* RF-DASH-01: bell icon — non-functional in v0.1 */}
      <button
        aria-label="Notificaciones"
        className="flex-shrink-0 mt-1 p-2 rounded-full bg-slate-800/60 border border-slate-700/50 text-slate-400"
        aria-disabled="true"
        tabIndex={-1}
      >
        <Bell className="w-5 h-5" strokeWidth={2} />
      </button>
    </header>
  )
}

function SeasonContext({ profile, stats }) {
  const battlesPlayed = (stats?.wins ?? 0) + (stats?.losses ?? 0)
  const progressPct = Math.min((battlesPlayed / TOTAL_BATTLES) * 100, 100)
  const daysLeft = daysUntil(profile.ladderStartDate)

  return (
    <section className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 space-y-2.5">
      {/* RF-DASH-02 */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-200">
          {profile.zoneName ?? 'Zona —'} · Liga {profile.league ?? '—'}
        </span>
        {profile.teamName && (
          <span className="text-xs text-slate-400 truncate max-w-[120px]">{profile.teamName}</span>
        )}
      </div>

      {/* RF-DASH-03 */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>Progreso Temporada · {battlesPlayed}/{TOTAL_BATTLES}</span>
          {daysLeft !== null && (
            <span className={daysLeft <= 3 ? 'text-orange-400 font-medium' : ''}>
              {daysLeft === 0
                ? 'Fase de duelos finalizada'
                : `${daysLeft} día${daysLeft === 1 ? '' : 's'} restantes`}
            </span>
          )}
        </div>
        <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
          <div
            className="h-full rounded-full bg-blue-500 transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>
    </section>
  )
}

function StatsGrid({ stats }) {
  const rankLabel = stats?.position != null ? `#${stats.position}` : '—'

  return (
    <section>
      <h2 className="text-xs text-slate-400 uppercase tracking-widest font-medium mb-2">
        Estadísticas
      </h2>
      <div className="grid grid-cols-2 gap-3">
        <StatsBadge icon="🏆" label="Victorias" value={stats?.wins ?? 0} colorClass="text-green-400" />
        <StatsBadge icon="✖" label="Derrotas" value={stats?.losses ?? 0} colorClass="text-red-400" />
        <StatsBadge icon="⭐" label="Win Rate" value={`${stats?.winRate ?? 0}%`} colorClass="text-yellow-400" />
        <StatsBadge icon="🏅" label="Ranking" value={rankLabel} colorClass="text-blue-400" />
      </div>
    </section>
  )
}

function PendingBattlesSection({ matches }) {
  return (
    <section className="space-y-2 pb-2">
      <div className="flex items-center justify-between">
        <h2 className="text-xs text-slate-400 uppercase tracking-widest font-medium flex items-center gap-1.5">
          <Swords className="w-3.5 h-3.5" strokeWidth={2} />
          Batallas Pendientes
        </h2>
        {matches.length > 0 && (
          <Link
            to="/batallas"
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            Ver todas →
          </Link>
        )}
      </div>

      {matches.length === 0 ? (
        <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl px-4 py-5 text-center">
          <p className="text-slate-300 font-medium">No tienes batallas pendientes 🎉</p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {matches.map((m) => (
              <PendingBattleCard key={m.scheduledMatchId} match={m} />
            ))}
          </div>
          <Link
            to="/batallas"
            className="block w-full text-center py-2.5 rounded-xl border border-blue-600/50 text-blue-400 text-sm font-medium hover:bg-blue-600/10 transition-colors"
          >
            Ver todas las batallas
          </Link>
        </>
      )}
    </section>
  )
}

function NoSeasonMessage() {
  return (
    <div className="flex flex-col items-center justify-center flex-1 text-center px-6 py-16 space-y-3">
      <span className="text-4xl">⚽</span>
      <p className="text-slate-200 font-semibold">Sin temporada activa</p>
      <p className="text-slate-400 text-sm">
        No estás asignado a ninguna temporada en curso. Contacta al administrador de tu liga.
      </p>
    </div>
  )
}

function ErrorState({ onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 text-center px-6 py-16 space-y-4">
      <span className="text-4xl">⚠️</span>
      <p className="text-slate-200 font-semibold">Error al cargar el dashboard</p>
      <p className="text-slate-400 text-sm">
        Ocurrió un problema al obtener tus datos. Verifica tu conexión e intenta de nuevo.
      </p>
      <button
        onClick={onRetry}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
      >
        <RefreshCw className="w-4 h-4" strokeWidth={2} />
        Reintentar
      </button>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {/* Header skeleton */}
      <div className="flex items-start justify-between pt-2">
        <div className="space-y-1.5">
          <SkeletonLine w="w-24" h="h-3" />
          <SkeletonLine w="w-48" h="h-6" />
        </div>
        <div className="w-9 h-9 rounded-full bg-slate-700/60 animate-pulse" />
      </div>

      {/* Season context skeleton */}
      <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 space-y-2.5">
        <SkeletonLine w="w-36" />
        <div className="space-y-1.5">
          <SkeletonLine w="w-full" h="h-3" />
          <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
            <div className="h-full w-1/3 bg-slate-600/60 rounded-full" />
          </div>
        </div>
      </div>

      {/* Stats skeleton */}
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 flex flex-col items-center gap-2"
          >
            <div className="w-8 h-8 rounded-full bg-slate-700/60 animate-pulse" />
            <SkeletonLine w="w-12" h="h-5" />
            <SkeletonLine w="w-16" h="h-3" />
          </div>
        ))}
      </div>

      {/* Battles skeleton */}
      <div className="space-y-2">
        <SkeletonLine w="w-32" h="h-3" />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function DashboardJugador() {
  const { playerId } = usePlayerAuth()
  const { profile, stats, pendingMatches, loading, error, retry } = useDashboard(playerId)

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      <main className="flex-1 flex flex-col px-4 pt-4 pb-24 max-w-md mx-auto w-full space-y-4">
        {loading && <LoadingSkeleton />}

        {!loading && error && <ErrorState onRetry={retry} />}

        {!loading && !error && (
          <>
            <Header name={profile?.name ?? profile?.nick ?? 'Jugador'} />

            {!profile ? (
              <NoSeasonMessage />
            ) : (
              <>
                <SeasonContext profile={profile} stats={stats} />
                <StatsGrid stats={stats} />
                <PendingBattlesSection matches={pendingMatches} />
              </>
            )}
          </>
        )}
      </main>

      <BottomNav pendingCount={pendingMatches.length} />
    </div>
  )
}
