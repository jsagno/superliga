import React from 'react'
import { Minus, TrendingDown, TrendingUp } from 'lucide-react'

function getTrend(deltaPosition) {
  if (deltaPosition > 0) {
    return {
      Icon: TrendingUp,
      label: 'Subió',
      className: 'text-emerald-400',
    }
  }

  if (deltaPosition < 0) {
    return {
      Icon: TrendingDown,
      label: 'Bajó',
      className: 'text-rose-400',
    }
  }

  return {
    Icon: Minus,
    label: 'Estable',
    className: 'text-slate-500',
  }
}

function getAvatarLabel(row) {
  const source = row.nick ?? row.name ?? 'J'
  return source.trim().charAt(0).toUpperCase()
}

export default function StandingsRow({ row, isCurrentPlayer = false, showZone = false, rowRef = null }) {
  const trend = getTrend(row.deltaPosition)
  const displayName = row.nick ?? row.name ?? 'Jugador'

  return (
    <div
      ref={rowRef}
      data-current-player={isCurrentPlayer ? 'true' : 'false'}
      data-player-id={row.playerId}
      className={[
        'flex items-center gap-3 rounded-2xl border px-4 py-3 transition-colors',
        isCurrentPlayer
          ? 'border-blue-500/40 bg-blue-500/10 shadow-[0_0_0_1px_rgba(59,130,246,0.15)]'
          : 'border-slate-800 bg-slate-900/70',
      ].join(' ')}
    >
      <div className="flex w-10 flex-col items-center justify-center text-center">
        <span className="text-xs text-slate-500">#</span>
        <span className="text-lg font-bold text-slate-100">{row.position}</span>
      </div>

      {row.teamLogo ? (
        <img
          src={row.teamLogo}
          alt={row.teamName ?? 'Team'}
          className="h-11 w-11 flex-shrink-0 rounded-full object-cover ring-1 ring-slate-700"
          title={row.teamName ?? 'Team'}
        />
      ) : (
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-slate-800 text-sm font-bold text-slate-100 ring-1 ring-slate-700">
          {getAvatarLabel(row)}
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold text-slate-100">{displayName}</p>
          {isCurrentPlayer && (
            <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-300">
              Tu
            </span>
          )}
          {row.currentTag && (
            <span className="truncate text-[11px] text-slate-500">{row.currentTag}</span>
          )}
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400">
          <span>
            {row.wins}W - {row.losses}L
          </span>
          {row.teamName && <span>{row.teamName}</span>}
          {showZone && row.zoneName && (
            <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[11px] text-slate-300">
              {row.zoneName}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-1 sm:flex">
          <trend.Icon className={`h-4 w-4 ${trend.className}`} strokeWidth={2} aria-hidden="true" />
          <span className={`text-xs ${trend.className}`}>{trend.label}</span>
        </div>

        <div className="text-right">
          <div className="text-lg font-bold text-slate-100">{row.pointsTotal}</div>
          <div className="text-[11px] text-slate-500">pts</div>
        </div>
      </div>
    </div>
  )
}