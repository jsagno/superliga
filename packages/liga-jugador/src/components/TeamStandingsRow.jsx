import React from 'react'
import { Minus, TrendingDown, TrendingUp } from 'lucide-react'

function getTrend(deltaPosition) {
  if (deltaPosition > 0) {
    return { Icon: TrendingUp, label: 'Subió', className: 'text-emerald-400' }
  }

  if (deltaPosition < 0) {
    return { Icon: TrendingDown, label: 'Bajó', className: 'text-rose-400' }
  }

  return { Icon: Minus, label: 'Estable', className: 'text-slate-500' }
}

export default function TeamStandingsRow({ row, isCurrentTeam = false }) {
  const trend = getTrend(row.deltaPosition)

  return (
    <div
      data-current-team={isCurrentTeam ? 'true' : 'false'}
      data-team-id={row.teamId}
      className={[
        'flex items-center gap-3 rounded-2xl border px-4 py-3',
        isCurrentTeam
          ? 'border-blue-500/40 bg-blue-500/10'
          : 'border-slate-800 bg-slate-900/70',
      ].join(' ')}
    >
      <div className="w-8 text-center text-lg font-bold text-slate-100">{row.position}</div>

      <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-slate-800 text-sm font-bold text-slate-100 ring-1 ring-slate-700">
        {(row.name ?? 'E').charAt(0).toUpperCase()}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold text-slate-100">{row.name}</p>
          {isCurrentTeam && (
            <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-300">
              Tu clan
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-slate-400">
          {row.wins}W - {row.losses}L
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-1 sm:flex">
          <trend.Icon className={`h-4 w-4 ${trend.className}`} strokeWidth={2} />
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