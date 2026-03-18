import React from 'react'
import { Eye, Swords, Trophy } from 'lucide-react'

const TYPE_LABEL = {
  CW_DAILY: 'Duelo Diario',
  CUP_MATCH: 'Copa de Liga',
  REVENGE: 'Copa Revenge',
}

function ResultBadge({ result }) {
  if (!result) return <span className="text-xs text-slate-500">Sin resultado</span>
  const isWin = result === 'WIN'
  const isDraw = result === 'DRAW'
  return (
    <span
      className={[
        'text-xs font-semibold px-2 py-0.5 rounded-full',
        isWin ? 'bg-emerald-500/15 text-emerald-300' : isDraw ? 'bg-slate-500/20 text-slate-400' : 'bg-rose-500/15 text-rose-300',
      ].join(' ')}
    >
      {isWin ? 'Victoria' : isDraw ? 'Empate' : 'Derrota'}
    </span>
  )
}

function toRelativeTime(iso) {
  if (!iso) return null
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 0) return null
  const mins = Math.floor(diff / 60_000)
  if (mins < 60) return `Hace ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `Hace ${hours} hora${hours === 1 ? '' : 's'}`
  const days = Math.floor(hours / 24)
  return `Hace ${days} día${days === 1 ? '' : 's'}`
}

export default function BattleCard({ item, onViewDetail }) {
  const TypeIcon = item.type === 'CUP_MATCH' ? Trophy : Swords
  const typeLabel = TYPE_LABEL[item.type] ?? item.type
  const relTime = toRelativeTime(item.battleTime)
  const hasScore = item.scoreA !== null && item.scoreB !== null

  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl px-4 py-3 flex items-center gap-3">
      {/* Type icon */}
      <div className="bg-blue-600/20 rounded-lg p-2 shrink-0">
        <TypeIcon className="w-4 h-4 text-blue-400" strokeWidth={2} />
      </div>

      {/* Main info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-slate-200 truncate">
            vs. {item.rivalName ?? 'Rival'}
          </p>
          <ResultBadge result={item.result} />
        </div>
        <p className="text-xs text-slate-500 truncate mt-0.5">
          {typeLabel}
          {item.competitionName ? ` · ${item.competitionName}` : ''}
          {hasScore ? ` · ${item.scoreA} - ${item.scoreB}` : ''}
          {relTime ? ` · ${relTime}` : ''}
        </p>
      </div>

      {/* Eye icon */}
      {item.battleIds?.length > 0 && (
        <button
          type="button"
          aria-label="Ver detalle de batalla"
          onClick={() => onViewDetail?.(item.battleIds[0])}
          className="shrink-0 w-8 h-8 rounded-lg bg-slate-700/60 flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-700"
        >
          <Eye className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}
