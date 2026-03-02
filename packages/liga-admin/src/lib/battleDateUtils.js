/**
 * Battle Date Utilities
 *
 * Centralized functions for battle-to-date assignment calculations and
 * disambiguation when multiple battles match the same scheduled date.
 *
 * Key Algorithms:
 * 1. getBattleDateKey - Convert battle timestamp to game date using configurable cutoff
 * 2. scoreBattleQuality - Score battles with weighted criteria (0-100)
 * 3. selectBestBattle - Choose best battle from multiple candidates
 */

/**
 * Convert battle timestamp to game date using configurable cutoff.
 *
 * The cutoff represents minutes before midnight UTC. For example, 590 minutes
 * means battles before 09:50 UTC are assigned to the previous day (game day runs
 * from 09:50 UTC yesterday to 09:50 UTC today).
 *
 * @param {string} battleTimestamp - ISO 8601 timestamp (e.g., '2026-02-28T09:45:00Z')
 * @param {number} [cutoffMinutes=600] - Minutes to subtract from battle time (default: 600 = 10:00 UTC)
 * @returns {string} Game date as ISO string (YYYY-MM-DD)
 *
 * @example
 * getBattleDateKey('2026-02-28T09:59:00Z', 600)
 * // → '2026-02-27' (before 10:00 UTC cutoff, previous day)
 *
 * getBattleDateKey('2026-02-28T10:00:00Z', 600)
 * // → '2026-02-28' (at/after 10:00 UTC cutoff, same day)
 */
export function getBattleDateKey(battleTimestamp, cutoffMinutes = 600) {
  const battleTime = new Date(battleTimestamp);

  // Subtract cutoff minutes to get effective game time
  const gameTime = new Date(battleTime);
  gameTime.setUTCMinutes(gameTime.getUTCMinutes() - cutoffMinutes);

  // Extract date in UTC (YYYY-MM-DD)
  const yyyy = gameTime.getUTCFullYear();
  const mm = String(gameTime.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(gameTime.getUTCDate()).padStart(2, '0');

  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Score battle quality for disambiguation using weighted criteria.
 *
 * When multiple battles match the same scheduled date, this function scores
 * each candidate to determine the best match.
 *
 * Scoring breakdown:
 * - Time Proximity (40%): Distance from scheduled window midpoint
 * - Battle Completeness (30%): round_count vs best_of value
 * - Window Fit (20%): Within scheduled time window + correct game date
 * - Deck Validity (10%): Battles with complete deck data score higher
 *
 * @param {Object} battle - Battle object with battle_id, battle_time, round_count, raw_payload
 * @param {string} scheduledFrom - ISO timestamp of scheduled window start
 * @param {string} scheduledTo - ISO timestamp of scheduled window end
 * @param {number} [cutoffMinutes=590] - Season cutoff configuration
 * @param {number} [bestOf=1] - Expected best_of value (e.g., best_of 3)
 * @returns {Object} Score object with total (0-100) and breakdown
 * @returns {number} return.total - Total score (0-100)
 * @returns {Object} return.breakdown - Individual component scores
 * @returns {number} return.breakdown.proximity - Time proximity score (0-40)
 * @returns {number} return.breakdown.completeness - Completeness score (0-30)
 * @returns {number} return.breakdown.windowFit - Window fit score (0-20)
 * @returns {number} return.breakdown.deckValidity - Deck validity score (0-10)
 *
 * @example
 * const battle = {
 *   battle_id: 12345,
 *   battle_time: '2026-02-28T14:00:00Z',
 *   round_count: 3,
 *   raw_payload: { team: [...] }
 * };
 * const score = scoreBattleQuality(
 *   battle,
 *   '2026-02-28T08:00:00Z',
 *   '2026-02-28T20:00:00Z',
 *   590,
 *   3
 * );
 * // → { total: 98.5, breakdown: { proximity: 40, completeness: 30, windowFit: 20, deckValidity: 10 } }
 */
export function scoreBattleQuality(battle, scheduledFrom, scheduledTo, cutoffMinutes = 600, bestOf = 1) {
  const battleTime = new Date(battle.battle_time);
  const from = new Date(scheduledFrom);
  const to = new Date(scheduledTo);

  // 1. Time Proximity Score (40 points max)
  // Distance from scheduled window midpoint (lower is better)
  const midpoint = new Date((from.getTime() + to.getTime()) / 2);
  const deltaMs = Math.abs(battleTime.getTime() - midpoint.getTime());
  const maxDelta = 12 * 60 * 60 * 1000; // 12 hours
  const proximityScore = Math.max(0, 40 * (1 - deltaMs / maxDelta));

  // 2. Battle Completeness Score (30 points max)
  // Higher round_count indicates complete battle
  const expectedRounds = bestOf || 1;
  const completenessRatio = Math.min(1, battle.round_count / expectedRounds);
  const completenessScore = 30 * completenessRatio;

  // 3. Window Fit Score (20 points max)
  // Prefer battles within window on correct game date
  const fullyWithin = battleTime >= from && battleTime <= to;
  const battleDateKey = getBattleDateKey(battle.battle_time, cutoffMinutes);
  const scheduledDateKey = getBattleDateKey(scheduledFrom, cutoffMinutes);
  const dateMatches = battleDateKey === scheduledDateKey;

  let windowFitScore = 0;
  if (fullyWithin && dateMatches) {
    windowFitScore = 20; // Best: within window + correct date
  } else if (dateMatches) {
    windowFitScore = 15; // Good: correct date, slightly outside time window
  } else if (fullyWithin) {
    windowFitScore = 10; // Okay: within time window but wrong game date
  }

  // 4. Deck Validity Score (10 points max)
  // Battles with complete deck data score higher
  const hasDeckData = battle.raw_payload?.team ? 10 : 0;

  const total = proximityScore + completenessScore + windowFitScore + hasDeckData;

  return {
    total: Math.round(total * 10) / 10, // Round to 1 decimal place
    breakdown: {
      proximity: Math.round(proximityScore * 10) / 10,
      completeness: Math.round(completenessScore * 10) / 10,
      windowFit: windowFitScore,
      deckValidity: hasDeckData
    }
  };
}

/**
 * Select best battle from multiple candidates using quality scoring.
 *
 * Compares all candidate battles, scores them, and returns the highest-quality
 * match along with the decision reasoning and alternatives.
 *
 * @param {Array} candidates - Array of battle objects to compare
 * @param {string} scheduledFrom - ISO timestamp of scheduled window start
 * @param {string} scheduledTo - ISO timestamp of scheduled window end
 * @param {number} [cutoffMinutes=590] - Season cutoff configuration
 * @param {number} [bestOf=1] - Expected best_of value
 * @returns {Object|null} Winner object or null if no candidates
 * @returns {Object} return.battle - Selected battle object
 * @returns {Object} return.score - Score object with total and breakdown
 * @returns {string} return.reason - Selection reason (SINGLE_CANDIDATE, HIGHEST_SCORE, CLEAR_WINNER, CLOSE_CALL)
 * @returns {Array} [return.alternatives] - Runner-up alternatives (if multiple candidates)
 *
 * @example
 * const candidates = [
 *   { battle_id: 1, battle_time: '2026-02-28T09:45:00Z', round_count: 1 },
 *   { battle_id: 2, battle_time: '2026-02-28T14:00:00Z', round_count: 3 }
 * ];
 * const result = selectBestBattle(candidates, '2026-02-28T08:00:00Z', '2026-02-28T20:00:00Z', 590, 3);
 * // → {
 * //   battle: { battle_id: 2, ... },
 * //   score: { total: 98, breakdown: {...} },
 * //   reason: 'CLEAR_WINNER',
 * //   alternatives: [{ battle_id: 1, score: 62 }]
 * // }
 */
export function selectBestBattle(candidates, scheduledFrom, scheduledTo, cutoffMinutes = 600, bestOf = 1) {
  if (!candidates || candidates.length === 0) {
    return null;
  }

  if (candidates.length === 1) {
    const score = scoreBattleQuality(candidates[0], scheduledFrom, scheduledTo, cutoffMinutes, bestOf);
    return {
      battle: candidates[0],
      score: score,
      reason: 'SINGLE_CANDIDATE'
    };
  }

  // Score all candidates
  const scored = candidates.map(battle => ({
    battle,
    score: scoreBattleQuality(battle, scheduledFrom, scheduledTo, cutoffMinutes, bestOf)
  }));

  // Sort by total score descending
  scored.sort((a, b) => b.score.total - a.score.total);

  const winner = scored[0];
  const runnerUp = scored[1];

  // Determine decision reason based on score difference
  let reason = 'HIGHEST_SCORE';
  const scoreDiff = winner.score.total - runnerUp.score.total;

  if (scoreDiff > 20) {
    reason = 'CLEAR_WINNER'; // Significant score difference (>20 points)
  } else if (scoreDiff < 5) {
    reason = 'CLOSE_CALL'; // Very close scores (<5 points), may need manual review
  }

  return {
    battle: winner.battle,
    score: winner.score,
    reason: reason,
    alternatives: scored.slice(1).map(s => ({
      battle_id: s.battle.battle_id,
      score: s.score.total
    }))
  };
}

/**
 * Validate that battle quality score meets minimum threshold.
 *
 * Battles must score above the threshold to be considered for linking.
 * This prevents low-quality or ambiguous matches from being auto-linked.
 *
 * @param {number} score - Total quality score (0-100)
 * @param {number} [threshold=30] - Minimum acceptable score
 * @returns {boolean} True if score meets threshold
 *
 * @example
 * isBattleQualityAcceptable(98, 30)  // → true
 * isBattleQualityAcceptable(15, 30)  // → false
 */
export function isBattleQualityAcceptable(score, threshold = 30) {
  return score >= threshold;
}

/**
 * Calculate time offset for UI display of cutoff time.
 *
 * Converts cutoff minutes to human-readable time format (HH:MM).
 * Used for showing admins what time the cutoff occurs in UTC.
 *
 * @param {number} cutoffMinutes - Cutoff minutes (e.g., 590)
 * @returns {string} Time string in HH:MM format (e.g., '09:50')
 *
 * @example
 * getDisplayTimeFromCutoff(590)  // → '09:50'
 * getDisplayTimeFromCutoff(420)  // → '07:00'
 * getDisplayTimeFromCutoff(0)    // → '00:00'
 */
export function getDisplayTimeFromCutoff(cutoffMinutes) {
  const hours = Math.floor(cutoffMinutes / 60);
  const minutes = cutoffMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Check if a battle falls within a specified time window.
 *
 * @param {string} battleTime - ISO timestamp of battle
 * @param {string} windowStart - ISO timestamp of window start
 * @param {string} windowEnd - ISO timestamp of window end
 * @returns {boolean} True if battle is within window
 *
 * @example
 * isWithinTimeWindow('2026-02-28T14:00:00Z', '2026-02-28T08:00:00Z', '2026-02-28T20:00:00Z')
 * // → true
 */
export function isWithinTimeWindow(battleTime, windowStart, windowEnd) {
  const battle = new Date(battleTime);
  const start = new Date(windowStart);
  const end = new Date(windowEnd);
  return battle >= start && battle <= end;
}
