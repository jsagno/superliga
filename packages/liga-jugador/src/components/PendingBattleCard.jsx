// SPEC: docs/openspec/changes/liga-jugador/specs/dashboard-jugador.md — RF-DASH-05
// SPEC: docs/openspec/changes/liga-jugador/specs/batallas-pendientes.md

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
        const elapsed = Math.abs(diff)
        const days = Math.floor(elapsed / 86_400_000)
        const hours = Math.floor((elapsed % 86_400_000) / 3_600_000)
        const mins = Math.floor((elapsed % 3_600_000) / 60_000)
        setDisplay({ expired: true, urgent: true, days, hours, mins })
        return
      }
      const days = Math.floor(diff / 86_400_000)
      const hours = Math.floor((diff % 86_400_000) / 3_600_000)
      const mins = Math.floor((diff % 3_600_000) / 60_000)
      const urgent = diff < 24 * 60 * 60 * 1000
      setDisplay({ expired: false, urgent, days, hours, mins })
    }

    calc()
    const id = setInterval(calc, 60_000)
    return () => clearInterval(id)
  }, [deadlineAt])

  return display
}

function CountdownSegment({ value, unit, urgent }) {
  return (
    <span
      className={[
        'flex flex-col items-center rounded-lg px-2 py-1 min-w-[34px]',
        urgent ? 'bg-red-500/15 text-red-400' : 'bg-slate-700/60 text-slate-300',
      ].join(' ')}
    >
      <span className="text-sm font-bold leading-none tabular-nums">{value}</span>
      <span className={`text-[10px] leading-none mt-0.5 ${urgent ? 'text-red-400/70' : 'text-slate-500'}`}>
        {unit}
      </span>
    </span>
  )
}

export default function PendingBattleCard({ match, onLink, onReport }) {
  const countdown = useCountdown(match.deadlineAt)
  const typeLabel = TYPE_LABEL[match.type] ?? match.type
  const TypeIcon = match.type === 'CUP_MATCH' ? Trophy : Swords
  const isLinkDisabled = Boolean(match.linkDisabled)

  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl px-4 py-3 flex flex-col gap-3">
      {/* Top row: rival info + action buttons */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="bg-blue-600/20 rounded-lg p-2 flex-shrink-0">
            <TypeIcon className="w-4 h-4 text-blue-400" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-200 truncate">
              {match.rivalName ?? 'Rival por confirmar'}
            </p>
            <p className="text-xs text-slate-500 truncate">
              {match.competitionName ? `${typeLabel} · ${match.competitionName}` : typeLabel}
            </p>
            {match.isVirtual && (
              <p className="text-[11px] text-amber-300/80 truncate">Pendiente visual (sin vinculación)</p>
            )}
          </div>
        </div>

        <div className="flex-shrink-0 flex items-center gap-2">
          <button
            type="button"
            onClick={() => onReport?.(match)}
            className="text-xs px-2.5 py-1 rounded-lg border border-slate-600 text-slate-300 hover:border-slate-500"
          >
            Reportar
          </button>
          <button
            type="button"
            onClick={() => onLink?.(match)}
            disabled={isLinkDisabled}
            className={[
              'text-xs px-2.5 py-1 rounded-lg text-white',
              isLinkDisabled
                ? 'bg-slate-700/70 text-slate-300 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-500',
            ].join(' ')}
          >
            {isLinkDisabled ? 'No vinculable' : 'Vincular'}
          </button>
        </div>
      </div>

      {/* Bottom row: vencimiento */}
      <div className="flex items-center gap-2 border-t border-slate-700/40 pt-2.5">
        <Clock
          className={`w-3.5 h-3.5 flex-shrink-0 ${countdown?.urgent ? 'text-red-400' : 'text-slate-500'}`}
          strokeWidth={2}
        />
        <span className={`text-xs mr-1 ${countdown?.urgent ? 'text-red-400/80' : 'text-slate-500'}`}>
          Vence en
        </span>
        {countdown ? (
          countdown.expired ? (
            <div className="flex items-center gap-1">
              <span className="text-xs font-semibold text-red-400 mr-0.5">Expirado hace</span>
              {countdown.days > 0 && (
                <CountdownSegment value={countdown.days} unit="días" urgent />
              )}
              <CountdownSegment value={countdown.hours} unit="hs" urgent />
              <CountdownSegment value={countdown.mins} unit="min" urgent />
            </div>
          ) : (
            <div className="flex items-center gap-1">
              {countdown.days > 0 && (
                <CountdownSegment value={countdown.days} unit="días" urgent={countdown.urgent} />
              )}
              <CountdownSegment value={countdown.hours} unit="hs" urgent={countdown.urgent} />
              <CountdownSegment value={countdown.mins} unit="min" urgent={countdown.urgent} />
            </div>
          )
        ) : (
          <span className="text-xs text-slate-500 italic">Sin fecha límite</span>
        )}
      </div>
    </div>
  )
}
