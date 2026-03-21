import React from 'react'

export default function StandingsRow({ row, isCurrentPlayer = false, showZone: _showZone = false, rowRef = null }) {
  const displayName = row.nick ?? row.name ?? 'Jugador'

  return (
    <tr
      ref={rowRef}
      data-current-player={isCurrentPlayer ? 'true' : 'false'}
      data-player-id={row.playerId}
      className={[
        'border-b border-slate-800 hover:bg-slate-800/30 transition-colors',
        isCurrentPlayer ? 'bg-blue-500/10' : '',
      ].join(' ')}
    >
      {/* Position */}
      <td className="px-1.5 py-2 text-center sm:px-3 sm:py-3">
        <span className={`inline-flex h-6 w-6 items-center justify-center rounded text-xs font-bold sm:h-7 sm:w-7 sm:text-sm ${
          row.position === 1 ? 'bg-yellow-500/30 text-yellow-300' :
          row.position === 2 ? 'bg-slate-400/20 text-slate-300' :
          row.position === 3 ? 'bg-amber-600/20 text-amber-400' :
          'text-white/50'
        }`}>
          {row.position}
        </span>
      </td>

      {/* Team Logo + Name */}
      <td className="px-1.5 py-2 text-left sm:px-3 sm:py-3">
        <div className="flex items-center gap-1.5 sm:gap-2">
          {row.teamLogo ? (
            <img
              src={row.teamLogo}
              alt={row.teamName ?? 'Team'}
              className="h-5 w-5 rounded-full object-cover flex-shrink-0 sm:h-6 sm:w-6"
              title={row.teamName ?? 'Team'}
            />
          ) : (
            <div className="h-5 w-5 flex-shrink-0 rounded-full bg-slate-700 sm:h-6 sm:w-6" />
          )}
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-slate-100 sm:text-sm">{displayName}</p>
            {isCurrentPlayer && (
              <span className="mt-0.5 inline-block rounded-full border border-blue-500/30 bg-blue-500/10 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-blue-300 sm:px-1.5 sm:text-[10px]">
                tú
              </span>
            )}
          </div>
        </div>
      </td>

      {/* Initial Points (AN) */}
      <td className="px-1.5 py-2 text-center text-[11px] text-slate-300 sm:px-3 sm:py-3 sm:text-xs">{row.initialPoints ?? 0}</td>

      {/* Bonus Points (AC) */}
      <td className="px-1.5 py-2 text-center text-[11px] text-slate-300 sm:px-3 sm:py-3 sm:text-xs">{row.bonusPoints ?? 0}</td>

      {/* Duels Points (⚔️) */}
      <td className="px-1.5 py-2 text-center text-[11px] text-slate-300 sm:px-3 sm:py-3 sm:text-xs">{row.duelsPoints ?? 0}</td>

      {/* Cup Points (🏆) */}
      <td className="px-1.5 py-2 text-center text-[11px] text-slate-300 sm:px-3 sm:py-3 sm:text-xs">{row.cupPoints ?? 0}</td>

      {/* Total Points */}
      <td className="px-1.5 py-2 text-center text-xs font-bold text-white sm:px-3 sm:py-3 sm:text-sm">{row.pointsTotal}</td>

      {/* Wins */}
      <td className="px-1.5 py-2 text-center text-[11px] text-green-400 sm:px-3 sm:py-3 sm:text-xs">{row.wins}</td>

      {/* Losses */}
      <td className="px-1.5 py-2 text-center text-[11px] text-red-400 sm:px-3 sm:py-3 sm:text-xs">{row.losses}</td>
    </tr>
  )
}