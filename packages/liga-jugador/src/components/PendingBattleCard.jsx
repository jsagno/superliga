import React, { useEffect, useState } from 'react'
import { Swords, Trophy, Clock } from 'lucide-react'

const TYPE_LABEL = {
  CW_DAILY: 'Duelo Diario',
  CUP_MATCH: 'Copa de Liga',
  REVENGE: 'Copa Revenge',
}

function useCountdown(deadlineAt) {
  const [display, setDisplay] = useState(null)

  useEffect(() => {
    if (!deadlineAt) return

    function calc() {
      const diff = new Date(deadlineAt).getTime() - Date.now()
      if (diff <= 0) {
        setDisplay({ text: 'Expirado', urgent: true })
        return
      }
      const days = Math.floor(diff / 86_400_000)
      const hours = Math.floor((diff % 86_400_000) / 3_600_000)
      const mins = Math.floor((diff % 3_600_000) / 60_000)
      const urgent = diff < 24 * 60 * 60 * 1000
      const text = days > 0
        ? `Limite dentro de ${days} dias, ${hours} horas, ${mins} min`
        : hours > 0
          ? `Limite dentro de ${hours} horas, ${mins} min`
          : `Limite dentro de ${mins} min`
      setDisplay({ text, urgent })
    }

    calc()
    const id = setInterval(calc, 60_000)
    return () => clearInterval(id)
  }, [deadlineAt])

  return display
}

export default function PendingBattleCard({ match, onLink, onReport }) {
  const countdown = useCountdown(match.deadlineAt)
  const typeLabel = TYPE_LABEL[match.type] ?? match.type
  const TypeIcon = match.type === 'CUP_MATCH' ? Trophy : Swords
  const rivalLabel = match.rivalName ?? 'Rival por confirmar'

  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="bg-blue-600/20 rounded-lg p-2 flex-shrink-0">
          <TypeIcon className="w-4 h-4 text-blue-400" strokeWidth={2} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-200 truncate" data-testid={`pending-rival-${match.scheduledMatchId}`}>
            {rivalLabel}
          </p>
          <p className="text-xs text-slate-500 truncate">
            {match.competitionName ? `${typeLabel} · ${match.competitionName}` : typeLabel}
          </p>
        </div>
      </div>

      <div className="flex-shrink-0 flex flex-col items-end gap-2">
        <div className="flex items-center gap-1.5">
          {countdown ? (
            <>
              <Clock className={`w-3.5 h-3.5 ${countdown.urgent ? 'text-red-400' : 'text-slate-500'}`} />
              <span
                className={`text-xs font-medium whitespace-nowrap ${
                  countdown.urgent ? 'text-red-400' : 'text-slate-400'
                }`}
              >
                {countdown.text}
              </span>
            </>
          ) : (
            <span className="text-xs text-slate-500">Sin horario fijado</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onReport?.(match)}
            className="text-xs px-2.5 py-1 rounded-lg border border-slate-600 text-slate-300 hover:border-slate-500"
            aria-label={`Reportar ${rivalLabel}`}
          >
            Reportar
          </button>
          <button
            type="button"
            onClick={() => onLink?.(match)}
            className="text-xs px-2.5 py-1 rounded-lg bg-blue-600 text-white hover:bg-blue-500"
            aria-label={`Vincular batalla con ${rivalLabel}`}
          >
            Vincular
          </button>
        </div>
      </div>
    </div>
  )
}
