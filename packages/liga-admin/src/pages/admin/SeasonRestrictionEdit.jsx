import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import CardGrid from '../../components/CardGrid';
import PlayerMultiSelect from '../../components/PlayerMultiSelect';
import { restrictionsService } from '../../services/restrictionsService';
import { getBaseCardId, getCardVariantFromSelectionId, getCardVariantLabel } from '../../utils/cardParser';

const REASON_OPTIONS = [
  'Tournament Rule',
  'Fair Play',
  'Balance Adjustment',
  'Event Restriction',
  'Administrative Decision',
];

const BATCH_SIZE = 50;

function normalizeSelectedRestriction(card) {
  return {
    card_id: getBaseCardId(card.card_id),
    restriction_variant: getCardVariantFromSelectionId(card.card_id),
  };
}

function buildRestrictionKey(playerId, cardId, restrictionVariant) {
  return `${playerId}:${Number(cardId)}:${restrictionVariant || 'normal'}`;
}

function isExistingRestriction(duplicateKeySet, playerId, card) {
  const selection = normalizeSelectedRestriction(card);
  return (
    duplicateKeySet.has(buildRestrictionKey(playerId, selection.card_id, selection.restriction_variant)) ||
    duplicateKeySet.has(buildRestrictionKey(playerId, selection.card_id, 'all'))
  );
}

export default function SeasonRestrictionEdit() {
  const navigate = useNavigate();
  const { seasonId } = useParams();

  const [selectedPlayers, setSelectedPlayers] = useState([]);
  const [selectedCards, setSelectedCards] = useState([]);
  const [reasonTemplate, setReasonTemplate] = useState('');
  const [customReason, setCustomReason] = useState('');

  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [existingRestrictions, setExistingRestrictions] = useState([]);

  const [validationError, setValidationError] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [progress, setProgress] = useState({ created: 0, total: 0 });

  const [partialResult, setPartialResult] = useState(null);
  const [errorDialog, setErrorDialog] = useState(null);

  const [toast, setToast] = useState({ show: false, type: 'success', message: '' });

  const showToast = useCallback((message, type = 'success') => {
    setToast({ show: true, type, message });
    setTimeout(() => {
      setToast({ show: false, type: 'success', message: '' });
    }, 4000);
  }, []);

  const selectedPlayerIds = useMemo(
    () => selectedPlayers.map(player => player.player_id),
    [selectedPlayers]
  );

  const selectedCardSelections = useMemo(
    () => selectedCards
      .map(card => normalizeSelectedRestriction(card))
      .filter(card => !Number.isNaN(card.card_id)),
    [selectedCards]
  );

  useEffect(() => {
    let cancelled = false;

    const runDuplicateCheck = async () => {
      if (!seasonId || selectedPlayerIds.length === 0 || selectedCardSelections.length === 0) {
        setExistingRestrictions([]);
        return;
      }

      try {
        setCheckingDuplicates(true);
        const existing = await restrictionsService.checkExistingRestrictions(
          seasonId,
          selectedPlayerIds,
          selectedCardSelections
        );
        if (!cancelled) {
          setExistingRestrictions(existing || []);
        }
      } catch (error) {
        console.error('Error checking duplicates:', error);
        if (!cancelled) {
          setExistingRestrictions([]);
          showToast('Could not validate duplicates', 'error');
        }
      } finally {
        if (!cancelled) {
          setCheckingDuplicates(false);
        }
      }
    };

    runDuplicateCheck();
    return () => {
      cancelled = true;
    };
  }, [seasonId, selectedPlayerIds, selectedCardSelections, showToast]);

  const duplicateKeySet = useMemo(() => {
    const keys = new Set();
    (existingRestrictions || []).forEach(row => {
      keys.add(buildRestrictionKey(row.player_id, row.card_id, row.restriction_variant || 'normal'));
    });
    return keys;
  }, [existingRestrictions]);

  const totalCombinations = selectedPlayers.length * selectedCards.length;
  const duplicateCount = useMemo(() => {
    let count = 0;
    selectedPlayers.forEach(player => {
      selectedCards.forEach(card => {
        if (isExistingRestriction(duplicateKeySet, player.player_id, card)) {
          count++;
        }
      });
    });
    return count;
  }, [selectedPlayers, selectedCards, duplicateKeySet]);
  const newCount = totalCombinations - duplicateCount;

  const resolvedReason = useMemo(() => {
    const custom = customReason.trim();
    if (custom) return custom;
    return reasonTemplate || null;
  }, [customReason, reasonTemplate]);

  const previewRows = useMemo(
    () =>
      selectedPlayers.map(player => ({
        ...player,
        cells: selectedCards.map(card => {
          const normalizedCard = normalizeSelectedRestriction(card);
          return {
            card_id: card.card_id,
            card_name: card.name || card.displayName,
            card_icon: card.parsed?.icon || card.displayIcon || null,
            isDuplicate: isExistingRestriction(duplicateKeySet, player.player_id, card),
            restriction_variant: normalizedCard.restriction_variant,
          };
        }),
      })),
    [selectedPlayers, selectedCards, duplicateKeySet]
  );

  const handlePlayerAdd = useCallback(player => {
    setSelectedPlayers(prev => {
      if (prev.some(item => item.player_id === player.player_id)) {
        return prev;
      }
      return [...prev, player];
    });
  }, []);

  const handlePlayerRemove = useCallback(player => {
    setSelectedPlayers(prev => prev.filter(item => item.player_id !== player.player_id));
  }, []);

  const handlePlayerClearAll = useCallback(() => {
    setSelectedPlayers([]);
  }, []);

  const handleCardToggle = useCallback(card => {
    setSelectedCards(prev => {
      const exists = prev.some(item => String(item.card_id) === String(card.card_id));
      if (exists) {
        return prev.filter(item => String(item.card_id) !== String(card.card_id));
      }

      return [...prev, card];
    });
  }, []);

  const buildNewRestrictions = useCallback(() => {
    const rows = [];
    selectedPlayers.forEach(player => {
      selectedCards.forEach(card => {
        const normalizedCard = normalizeSelectedRestriction(card);

        if (!isExistingRestriction(duplicateKeySet, player.player_id, card)) {
          rows.push({
            player_id: player.player_id,
            card_id: normalizedCard.card_id,
            restriction_variant: normalizedCard.restriction_variant,
            reason: resolvedReason,
            created_by: null,
          });
        }
      });
    });
    return rows;
  }, [selectedPlayers, selectedCards, duplicateKeySet, resolvedReason]);

  const handleRequestApply = useCallback(() => {
    if (selectedPlayers.length === 0) {
      setValidationError('Select at least one player');
      return;
    }
    if (selectedCards.length === 0) {
      setValidationError('Select at least one card');
      return;
    }
    setValidationError('');
    setShowConfirmDialog(true);
  }, [selectedPlayers.length, selectedCards.length]);

  const runBulkCreate = useCallback(
    async restrictionsToCreate => {
      if (!restrictionsToCreate.length) {
        showToast('No new restrictions to create (all are duplicates)', 'success');
        navigate(`/admin/seasons/${seasonId}/restrictions`);
        return;
      }

      setIsApplying(true);
      setProgress({ created: 0, total: restrictionsToCreate.length });

      try {
        const result = await restrictionsService.bulkCreateRestrictions(restrictionsToCreate, seasonId);
        setProgress({ created: result.success, total: restrictionsToCreate.length });

        if (result.failed > 0) {
          const failedRestrictions = [];
          result.errors.forEach(batchError => {
            const batchIndex = Math.max((batchError.batch || 1) - 1, 0);
            const start = batchIndex * BATCH_SIZE;
            const end = start + BATCH_SIZE;
            failedRestrictions.push(...restrictionsToCreate.slice(start, end));
          });

          setPartialResult({
            success: result.success,
            failed: result.failed,
            errors: result.errors,
            failedRestrictions,
          });
          return;
        }

        showToast(`Created ${result.success} restrictions`, 'success');
        navigate(`/admin/seasons/${seasonId}/restrictions`);
      } catch (error) {
        console.error('Error applying restrictions:', error);
        setErrorDialog({
          message: error.message || 'Bulk create failed',
          details: [
            {
              error: error.message || 'Unknown error',
            },
          ],
        });
      } finally {
        setIsApplying(false);
      }
    },
    [navigate, seasonId, showToast]
  );

  const handleConfirmApply = useCallback(async () => {
    setShowConfirmDialog(false);
    const restrictionsToCreate = buildNewRestrictions();
    await runBulkCreate(restrictionsToCreate);
  }, [buildNewRestrictions, runBulkCreate]);

  const handleRetryFailed = useCallback(async () => {
    if (!partialResult?.failedRestrictions?.length) return;
    const failedRows = partialResult.failedRestrictions;
    setPartialResult(null);
    await runBulkCreate(failedRows);
  }, [partialResult, runBulkCreate]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Editar Restricciones (RES)</h1>
          <p className="text-sm text-slate-400 mt-1">Selecciona jugadores y cartas para aplicar restricciones masivas</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(`/admin/seasons/${seasonId}/restrictions`)}
            className="px-4 py-2 rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            onClick={handleRequestApply}
            disabled={isApplying}
            className="px-4 py-2 rounded-lg bg-brand hover:bg-brand-hover text-white font-medium disabled:opacity-50"
          >
            Apply Restrictions
          </button>
        </div>
      </div>

      {validationError && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
          {validationError}
        </div>
      )}

      <section className="rounded-lg border border-slate-700 bg-slate-900/30 p-4 space-y-3">
        <h2 className="text-lg font-semibold text-white">1) Select Players</h2>
        <PlayerMultiSelect
          seasonId={seasonId}
          selectedPlayers={selectedPlayers}
          onPlayerAdd={handlePlayerAdd}
          onPlayerRemove={handlePlayerRemove}
          onClearAll={handlePlayerClearAll}
        />
      </section>

      <section className="rounded-lg border border-slate-700 bg-slate-900/30 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">2) Select Cards</h2>
          <p className="text-sm text-slate-400">{selectedCards.length} cards selected</p>
        </div>
        <CardGrid selectedCards={selectedCards} onCardToggle={handleCardToggle} />
      </section>

      <section className="rounded-lg border border-slate-700 bg-slate-900/30 p-4 space-y-3">
        <h2 className="text-lg font-semibold text-white">3) Add Reason (Optional)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <select
            value={reasonTemplate}
            onChange={event => setReasonTemplate(event.target.value)}
            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white"
          >
            <option value="">Select predefined reason</option>
            {REASON_OPTIONS.map(option => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <div className="text-sm text-slate-400 self-center">
            Final reason: {resolvedReason || 'None'}
          </div>
        </div>
        <div>
          <textarea
            value={customReason}
            onChange={event => setCustomReason(event.target.value.slice(0, 500))}
            rows={3}
            maxLength={500}
            placeholder="Custom reason (optional, max 500 chars)"
            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white placeholder-slate-500"
          />
          <p className="text-xs text-slate-500 text-right mt-1">{customReason.length} / 500</p>
        </div>
      </section>

      <section className="rounded-lg border border-slate-700 bg-slate-900/30 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-white">4) Preview</h2>
          <div className="text-sm text-slate-300">
            Total: <span className="font-semibold">{totalCombinations}</span> · New:{' '}
            <span className="font-semibold text-emerald-400">{newCount}</span> · Duplicates:{' '}
            <span className="font-semibold text-amber-400">{duplicateCount}</span>
          </div>
        </div>

        {checkingDuplicates && (
          <p className="text-sm text-slate-400">Checking existing restrictions...</p>
        )}

        {selectedPlayers.length === 0 || selectedCards.length === 0 ? (
          <p className="text-sm text-slate-400">
            Select at least one player and one card to generate preview matrix.
          </p>
        ) : (
          <div className="overflow-x-auto rounded border border-slate-700">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-900/80">
                <tr>
                  <th className="px-3 py-2 text-left text-slate-300 sticky left-0 bg-slate-900/80 z-10">Player</th>
                  {selectedCards.map(card => (
                    <th key={card.card_id} className="px-3 py-2 text-center text-slate-300 min-w-[100px]">
                      <div className="flex flex-col items-center gap-1">
                        {(card.displayIcon || card.parsed?.icon) ? (
                          <img src={card.displayIcon || card.parsed?.icon} alt={card.displayName || card.name} className="w-6 h-6 rounded" loading="lazy" />
                        ) : (
                          <span className="text-sm">🃏</span>
                        )}
                        <span className="truncate max-w-[90px] text-xs">{card.displayName || card.name}</span>
                        <span className="text-[10px] uppercase text-slate-500">{getCardVariantLabel(getCardVariantFromSelectionId(card.card_id))}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map(row => (
                  <tr key={row.player_id} className="border-t border-slate-800">
                    <td className="px-3 py-2 sticky left-0 bg-slate-900/70 z-10">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-brand/30 border border-brand/50 flex items-center justify-center text-xs font-bold text-white">
                          {(row.name || '?').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-white text-sm leading-tight">{row.name}</p>
                          <p className="text-xs text-slate-400 leading-tight">{row.zone_name || '—'}</p>
                        </div>
                      </div>
                    </td>
                    {row.cells.map(cell => (
                      <td key={`${row.player_id}-${cell.card_id}`} className="px-3 py-2 text-center">
                        {cell.isDuplicate ? (
                          <span title="Duplicate restriction" className="text-amber-400 font-semibold">⚠️</span>
                        ) : (
                          <span title="New restriction" className="text-emerald-400 font-semibold">✓</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md rounded-lg border border-slate-700 bg-slate-900 p-5 space-y-4">
            <h3 className="text-lg font-semibold text-white">Create {newCount} restrictions?</h3>
            <p className="text-sm text-slate-300">
              This will restrict {selectedCards.length} cards for {selectedPlayers.length} players.
            </p>
            {duplicateCount > 0 && (
              <p className="text-sm text-amber-300">{duplicateCount} duplicates will be skipped.</p>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowConfirmDialog(false)}
                className="px-3 py-2 rounded border border-slate-600 text-slate-200 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmApply}
                className="px-3 py-2 rounded bg-brand hover:bg-brand-hover text-white"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {isApplying && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md rounded-lg border border-slate-700 bg-slate-900 p-5 space-y-4">
            <h3 className="text-lg font-semibold text-white">Applying restrictions...</h3>
            <p className="text-sm text-slate-300">{progress.created} / {progress.total} restrictions created</p>
            <div className="w-full h-2 rounded bg-slate-800 overflow-hidden">
              <div
                className="h-2 bg-brand transition-all"
                style={{ width: progress.total ? `${Math.round((progress.created / progress.total) * 100)}%` : '0%' }}
              />
            </div>
          </div>
        </div>
      )}

      {partialResult && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-2xl rounded-lg border border-slate-700 bg-slate-900 p-5 space-y-4">
            <h3 className="text-lg font-semibold text-white">Partial Success</h3>
            <p className="text-sm text-slate-300">
              {partialResult.success} created, {partialResult.failed} failed.
            </p>
            <div className="max-h-64 overflow-y-auto rounded border border-slate-700 bg-slate-950/50">
              <ul className="divide-y divide-slate-800">
                {partialResult.errors.map((errorItem, index) => (
                  <li key={`${errorItem.batch}-${index}`} className="px-3 py-2 text-sm">
                    <span className="text-slate-200">Batch {errorItem.batch}</span>
                    <span className="text-slate-400"> · {errorItem.rows} rows · </span>
                    <span className="text-red-300">{errorItem.error}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setPartialResult(null);
                  navigate(`/admin/seasons/${seasonId}/restrictions`);
                }}
                className="px-3 py-2 rounded border border-slate-600 text-slate-200 hover:bg-slate-800"
              >
                Ignore Errors
              </button>
              <button
                onClick={handleRetryFailed}
                className="px-3 py-2 rounded bg-brand hover:bg-brand-hover text-white"
              >
                Retry Failed
              </button>
            </div>
          </div>
        </div>
      )}

      {errorDialog && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-lg rounded-lg border border-red-500/40 bg-slate-900 p-5 space-y-4">
            <h3 className="text-lg font-semibold text-red-300">Error applying restrictions</h3>
            <p className="text-sm text-slate-200">{errorDialog.message}</p>
            <div className="max-h-48 overflow-y-auto rounded border border-slate-700 bg-slate-950/50">
              <ul className="divide-y divide-slate-800">
                {(errorDialog.details || []).map((errorItem, index) => (
                  <li key={index} className="px-3 py-2 text-sm text-red-200">
                    {errorItem.error || 'Unknown error'}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setErrorDialog(null)}
                className="px-3 py-2 rounded border border-slate-600 text-slate-200 hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {toast.show && (
        <div
          className={`fixed bottom-6 right-6 px-4 py-3 rounded-lg border z-50 shadow-lg ${
            toast.type === 'error'
              ? 'bg-red-500/20 border-red-500/40 text-red-200'
              : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-200'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
