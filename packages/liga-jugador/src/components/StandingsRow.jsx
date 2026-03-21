import React from 'react'

function getAvatarLabel(row) {
  const source = row.nick ?? row.name ?? 'J'
  return source.trim().charAt(0).toUpperCase()
}

export default function StandingsRow({ row, isCurrentPlayer = false, showZone = false, rowRef = null }) {
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
      <td className="px-3 py-3 text-center">
        <span className={`inline-flex w-7 h-7 items-center justify-center rounded text-sm font-bold ${
          row.position === 1 ? 'bg-yellow-500/30 text-yellow-300' :
          row.position === 2 ? 'bg-slate-400/20 text-slate-300' :
          row.position === 3 ? 'bg-amber-600/20 text-amber-400' :
          'text-white/50'
        }`}>
          {row.position}
        </span>
      </td>

      {/* Team Logo + Name */}
      <td className="px-3 py-3 text-left">
        <div className="flex items-center gap-2">
          {row.teamLogo ? (
            <img
              src={row.teamLogo}
              alt={row.teamName ?? 'Team'}
              className="h-6 w-6 rounded-full object-cover flex-shrink-0"
              title={row.teamName ?? 'Team'}
            />
          ) : (
            <div className="h-6 w-6 flex-shrink-0 rounded-full bg-slate-700" />
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-100">{displayName}</p>
            {isCurrentPlayer && (
              <span className="inline-block rounded-full border border-blue-500/30 bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-300 mt-0.5">
                tú
              </span>
            )}
          </div>
        </div>
      </td>

      {/* Initial Points (AN) */}
      <td className="px-3 py-3 text-center text-xs text-slate-300">{row.initialPoints ?? 0}</td>

      {/* Bonus Points (AC) */}
      <td className="px-3 py-3 text-center text-xs text-slate-300">{row.bonusPoints ?? 0}</td>

      {/* Duels Points (⚔️) */}
      <td className="px-3 py-3 text-center text-xs text-slate-300">{row.duelsPoints ?? 0}</td>

      {/* Cup Points (🏆) */}
      <td className="px-3 py-3 text-center text-xs text-slate-300">{row.cupPoints ?? 0}</td>

      {/* Total Points */}
      <td className="px-3 py-3 text-center text-sm font-bold text-white">{row.pointsTotal}</td>

      {/* Wins */}
      <td className="px-3 py-3 text-center text-xs text-green-400">{row.wins}</td>

      {/* Losses */}
      <td className="px-3 py-3 text-center text-xs text-red-400">{row.losses}</td>
    </tr>
  )
}