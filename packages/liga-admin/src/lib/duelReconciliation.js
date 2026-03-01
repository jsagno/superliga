/**
 * Duel Reconciliation Utilities
 * 
 * Core logic for computing effective duel scheduling windows and reconciling
 * scheduled matches with season boundaries and player assignment windows.
 * 
 * Key Concepts:
 * - seasonWindow: [duel_start_date, duel_end_date] defines the season's duel period
 * - playerWindow: [assignment.start_date, assignment.end_date] defines when a player 
 *   is assigned to a zone for that season
 * - effectiveWindow: intersection of season and player windows, used to determine
 *   which days should have scheduled matches
 */

/**
 * Normalize a date to ISO string format (YYYY-MM-DD) using local time.
 * Prevents timezone drift by working with local dates.
 * 
 * @param {Date|string} date - Date to normalize
 * @returns {string} ISO date string (YYYY-MM-DD)
 */
export function dateKey(date) {
  if (typeof date === 'string') {
    return date; // Already in ISO format
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse an ISO date string to a Date object at local midnight.
 * 
 * @param {string} dateStr - ISO date string (YYYY-MM-DD)
 * @returns {Date} Date object at 00:00:00 local time
 */
export function parseIsoDate(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Compute the effective window for duel scheduling.
 * The effective window is the intersection of the season's duel period
 * and the player's assignment period.
 * 
 * @param {Object} seasonDates - Season date boundaries
 * @param {string} seasonDates.duel_start_date - YYYY-MM-DD
 * @param {string} seasonDates.duel_end_date - YYYY-MM-DD
 * @param {Object} assignmentDates - Player assignment date boundaries
 * @param {string|null} assignmentDates.start_date - YYYY-MM-DD or null
 * @param {string|null} assignmentDates.end_date - YYYY-MM-DD or null
 * @returns {Object} Effective window or null if outside season range
 * @returns {Date} return.start - Start of effective window (local midnight)
 * @returns {Date} return.end - End of effective window (local midnight)
 */
export function computeEffectiveWindow(seasonDates, assignmentDates) {
  const seasonStart = parseIsoDate(seasonDates.duel_start_date);
  const seasonEnd = parseIsoDate(seasonDates.duel_end_date);
  
  // Player assignment boundaries default to season boundaries if not set
  const playerStart = assignmentDates.start_date 
    ? parseIsoDate(assignmentDates.start_date)
    : seasonStart;
  const playerEnd = assignmentDates.end_date
    ? parseIsoDate(assignmentDates.end_date)
    : seasonEnd;

  // Compute intersection of windows
  const effectiveStart = playerStart > seasonStart ? playerStart : seasonStart;
  const effectiveEnd = playerEnd < seasonEnd ? playerEnd : seasonEnd;

  // Return null if window is invalid (start > end)
  if (effectiveStart > effectiveEnd) {
    return null;
  }

  return { start: effectiveStart, end: effectiveEnd };
}

/**
 * Generate all dates in a closed range [start, end] inclusive.
 * 
 * @param {Date} start - Start date (inclusive)
 * @param {Date} end - End date (inclusive)
 * @returns {Set<string>} Set of ISO date strings in the range
 */
export function generateDateRange(start, end) {
  const dates = new Set();
  const current = new Date(start);
  while (current <= end) {
    dates.add(dateKey(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

/**
 * Reconciliation action result summary.
 * Tracks outcomes of duel reconciliation operations.
 * 
 * @typedef {Object} ReconciliationResult
 * @property {number} created - Number of scheduled_match rows created
 * @property {number} skipped - Number of expected days that already had pending matches
 * @property {number} canceled - Number of pending matches canceled for being out-of-window
 */

/**
 * Validate reconciliation parameters.
 * Throws descriptive errors if inputs are invalid.
 * 
 * @param {Object} seasonDates - Season date boundaries
 * @param {Object} assignment - Player assignment with dates
 * @throws {Error} If dates are invalid or missing required fields
 */
export function validateReconciliationInputs(seasonDates, assignment) {
  if (!seasonDates.duel_start_date || !seasonDates.duel_end_date) {
    throw new Error('Season must have duel_start_date and duel_end_date');
  }
  if (!assignment || typeof assignment.start_date === 'undefined') {
    throw new Error('Assignment must have start_date field');
  }
  
  // Verify dates are valid ISO strings
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(seasonDates.duel_start_date) || 
      !dateRegex.test(seasonDates.duel_end_date)) {
    throw new Error('Season dates must be ISO format (YYYY-MM-DD)');
  }
  if (assignment.start_date && !dateRegex.test(assignment.start_date)) {
    throw new Error('Assignment start_date must be ISO format (YYYY-MM-DD)');
  }
  if (assignment.end_date && !dateRegex.test(assignment.end_date)) {
    throw new Error('Assignment end_date must be ISO format (YYYY-MM-DD)');
  }
}
