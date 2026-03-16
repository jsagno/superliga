import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Eye, X } from 'lucide-react'
import { fetchUnlinkedBattles, linkBattlesToScheduledMatch } from '../services/battlesService.js'
import BattleDetailModal from './BattleDetailModal.jsx'

function ResultBadge({ result }) {
  const isWin = result === 'WIN'
  return (
    <span
      className={[
        'text-xs font-semibold px-2 py-0.5 rounded-full',
        isWin ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300',
      ].join(' ')}
    >
      {isWin ? 'Victoria' : 'Derrota'}
    </span>
  )
}


export default function VincularBatallaPanel({ open, onClose, matchContext, appUserId, onLinked }) {
  const [rows, setRows] = useState([])
  const [selectedIds, setSelectedIds] = useState([])
  const [loading, setLoading] = useState(false)
  const [linking, setLinking] = useState(false)
  const [error, setError] = useState(null)
  const [detailBattleId, setDetailBattleId] = useState(null)

  const load = useCallback(async () => {
    if (!open || !matchContext) return
    setLoading(true)
    setError(null)

    try {
      const data = await fetchUnlinkedBattles(matchContext, 10)
      setRows(data)
      setSelectedIds([])
    } catch (err) {
      console.error('Failed to load unlinked battles:', err)
      setError('No se pudieron cargar batallas para vincular')
    } finally {
      setLoading(false)
    }
  }, [open, matchContext])

  useEffect(() => {
    load()
  }, [load])

  const selectedCount = selectedIds.length
  const totalCount = rows.length

  const canLink = useMemo(() => selectedCount > 0 && !linking, [selectedCount, linking])

  function toggleSelection(battleId) {
    setSelectedIds((prev) => (
      prev.includes(battleId) ? prev.filter((id) => id !== battleId) : [...prev, battleId]
    ))
  }

  async function handleConfirmLink() {
    if (!canLink || !matchContext) return

    setLinking(true)
    setError(null)

    try {
      await linkBattlesToScheduledMatch(matchContext.scheduledMatchId, selectedIds, appUserId)
      onLinked?.({
        scheduledMatchId: matchContext.scheduledMatchId,
        battleIds: selectedIds,
      })
      onClose?.()
    } catch (err) {
      console.error('Linking battles failed:', err)
      setError(err.message ?? 'No se pudo vincular las batallas seleccionadas')
    } finally {
      setLinking(false)
    }
  }

  if (!open || !matchContext) return null

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60" onClick={onClose} aria-hidden="true" />
      <aside className="fixed bottom-0 left-0 right-0 z-[60] rounded-t-3xl border-t border-slate-700 bg-slate-900 max-h-[80vh] flex flex-col">
        <header className="px-4 pt-4 pb-3 border-b border-slate-800 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Historico de Batallas</h2>
            <p className="text-sm text-slate-400">Vinculando a: {matchContext.rivalName ?? 'Rival por confirmar'}</p>
            <p className="text-xs text-slate-500 mt-1">Mostrando ultimas {Math.max(totalCount, 0)} batallas no vinculadas</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-200" aria-label="Cerrar panel vincular">
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {loading && (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, idx) => (
                <div key={idx} className="h-16 rounded-xl bg-slate-800/70 animate-pulse" />
              ))}
            </div>
          )}

          {!loading && error && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-200 px-3 py-2 text-sm">
              {error}
            </div>
          )}

          {!loading && !error && rows.length === 0 && (
            <div className="rounded-xl border border-slate-700 bg-slate-800/50 text-slate-300 px-3 py-4 text-sm">
              No se encontraron batallas recientes contra este rival
            </div>
          )}

          {!loading && !error && rows.map((battle) => {
            const checked = selectedIds.includes(battle.battleId)
            return (
              <div key={battle.battleId} className="rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-2.5 flex items-center gap-3">
                <input
                  type="checkbox"
                  aria-label={`Seleccionar batalla ${battle.battleId}`}
                  checked={checked}
                  onChange={() => toggleSelection(battle.battleId)}
                  className="accent-blue-500"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <ResultBadge result={battle.result} />
                    <span className="text-xs text-slate-400">{battle.typeLabel}</span>
                  </div>
                  <p className="text-sm text-slate-200">{battle.score}</p>
                  <p className="text-xs text-slate-500">{battle.relativeTime}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setDetailBattleId(battle.battleId)}
                  className="text-slate-300 hover:text-blue-300"
                  aria-label={`Ver detalle de ${battle.battleId}`}
                >
                  <Eye className="w-4 h-4" />
                </button>
              </div>
            )
          })}
        </div>

        <footer className="px-4 py-3 border-t border-slate-800 flex items-center justify-between gap-3 sticky bottom-0 bg-slate-900">
          <p className="text-xs text-slate-400">Seleccionadas: {selectedCount} de {totalCount}</p>
          <button
            type="button"
            onClick={handleConfirmLink}
            disabled={!canLink}
            className="px-4 py-2 rounded-xl text-sm font-semibold bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-500"
          >
            {linking ? 'Vinculando...' : 'Vincular Batallas'}
          </button>
        </footer>
      </aside>

      {detailBattleId && (
        <BattleDetailModal battleId={detailBattleId} onClose={() => setDetailBattleId(null)} />
      )}
    </>
  )
}
