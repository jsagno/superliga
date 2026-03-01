import { getBattleDateKey } from "./battleDateUtils";

function toDateOnly(value) {
  if (!value) return null;
  return String(value).slice(0, 10);
}

/**
 * Checks whether a player is active on a season date.
 * Dates are evaluated as YYYY-MM-DD so lexical comparison is safe.
 */
export function isPlayerActiveOnDate(player, dateStr) {
  if (!player || !dateStr) return false;

  const startDate = toDateOnly(player.start_date);
  const endDate = toDateOnly(player.end_date);

  if (startDate && dateStr < startDate) return false;
  if (endDate && dateStr > endDate) return false;

  return true;
}

/**
 * Returns the penalty for a missed scheduled day based on the current streak.
 */
export function getPenaltyForConsecutiveMisses(missCount) {
  if (missCount <= 0) return 0;
  if (missCount === 1) return -1;
  if (missCount === 2) return -2;
  if (missCount === 3) return -5;
  return -10;
}

/**
 * Groups ordered season dates into round buckets of `daysPerRound`.
 */
export function calculateRounds(dates, daysPerRound) {
  const safeDaysPerRound = Math.max(1, Number(daysPerRound) || 4);
  const rounds = [];

  for (let index = 0; index < dates.length; index += safeDaysPerRound) {
    const slice = dates.slice(index, index + safeDaysPerRound);
    rounds.push({
      number: Math.floor(index / safeDaysPerRound) + 1,
      dates: slice,
      startIndex: index,
      endIndex: index + slice.length - 1,
    });
  }

  return rounds;
}

/**
 * Applies streak-based penalties for missed scheduled dates.
 * Example:
 * - Miss, miss, play, miss => penalties -1, -2, reset, -1
 */
export function applyConsecutiveMissPenalties({
  scheduledDates,
  playedDatesSet,
  isActiveOnDate,
  todayDateKey,
}) {
  const penaltiesByDate = {};
  let consecutiveMisses = 0;
  let excluded = false;

  const orderedDates = [...(scheduledDates || [])].sort();

  orderedDates.forEach((dateKey) => {
    if (todayDateKey && dateKey > todayDateKey) return;
    if (!isActiveOnDate(dateKey)) return;

    if (playedDatesSet.has(dateKey)) {
      consecutiveMisses = 0;
      return;
    }

    consecutiveMisses += 1;
    penaltiesByDate[dateKey] = {
      points: getPenaltyForConsecutiveMisses(consecutiveMisses),
      missCount: consecutiveMisses,
    };

    if (consecutiveMisses >= 4) {
      excluded = true;
    }
  });

  return {
    penaltiesByDate,
    excluded,
  };
}

/**
 * Builds the daily points grid model consumed by SeasonDailyPoints.
 * Includes:
 * - Date extraction and round grouping
 * - Consecutive miss penalties
 * - Player exclusion after 4 consecutive misses
 */
export function buildDailyPointsGrid({
  season,
  matches,
  players,
  searchPlayer,
  filterTeamId,
  battleCutoffMinutes,
  todayDateKey,
}) {
  if (!season) return { dates: [], rows: [], rounds: [] };

  const seasonStartDate = toDateOnly(season.duel_start_date || season.season_start_at);
  const seasonEndDate = toDateOnly(season.season_end_at);

  const datesSet = new Set();
  const playerDatePoints = {};
  const playerScheduledDates = {};

  (matches || []).forEach((match) => {
    if (!match.player_a_id || !match.scheduled_from) return;

    const dateKey = getBattleDateKey(match.scheduled_from, battleCutoffMinutes);
    if (!dateKey) return;
    if (seasonStartDate && dateKey < seasonStartDate) return;
    if (seasonEndDate && dateKey > seasonEndDate) return;

    datesSet.add(dateKey);

    if (!playerScheduledDates[match.player_a_id]) {
      playerScheduledDates[match.player_a_id] = new Set();
    }
    playerScheduledDates[match.player_a_id].add(dateKey);

    if (!playerDatePoints[match.player_a_id]) {
      playerDatePoints[match.player_a_id] = {};
    }
    if (!playerDatePoints[match.player_a_id][dateKey]) {
      playerDatePoints[match.player_a_id][dateKey] = {
        points: 0,
        hasResult: false,
        isPenalty: false,
        missCount: 0,
      };
    }

    const resultRow = Array.isArray(match.result) ? match.result[0] : match.result;
    const pointsA = resultRow?.points_a;

    if (typeof pointsA === "number") {
      playerDatePoints[match.player_a_id][dateKey].points += pointsA;
      playerDatePoints[match.player_a_id][dateKey].hasResult = true;
      playerDatePoints[match.player_a_id][dateKey].isPenalty = false;
    }
  });

  const dates = Array.from(datesSet).sort();
  const rounds = calculateRounds(dates, season.days_per_round ?? 4);

  const playersById = new Map((players || []).map((player) => [player.player_id, player]));
  const effectiveTodayDateKey =
    todayDateKey || getBattleDateKey(new Date().toISOString(), battleCutoffMinutes);

  const excludedPlayerIds = new Set();

  Object.entries(playerScheduledDates).forEach(([playerId, scheduledDatesSet]) => {
    const player = playersById.get(playerId);
    if (!player) return;

    const dayPointsMap = playerDatePoints[playerId] || {};
    const playedDatesSet = new Set(
      Object.entries(dayPointsMap)
        .filter(([, value]) => value?.hasResult)
        .map(([dateKey]) => dateKey)
    );

    const penaltyResult = applyConsecutiveMissPenalties({
      scheduledDates: Array.from(scheduledDatesSet),
      playedDatesSet,
      isActiveOnDate: (dateKey) => isPlayerActiveOnDate(player, dateKey),
      todayDateKey: effectiveTodayDateKey,
    });

    Object.entries(penaltyResult.penaltiesByDate).forEach(([dateKey, penaltyData]) => {
      dayPointsMap[dateKey] = {
        points: penaltyData.points,
        hasResult: false,
        isPenalty: true,
        missCount: penaltyData.missCount,
      };
    });

    playerDatePoints[playerId] = dayPointsMap;

    if (penaltyResult.excluded) {
      excludedPlayerIds.add(playerId);
    }
  });

  const rows = (players || [])
    .filter((player) => !excludedPlayerIds.has(player.player_id))
    .filter((player) => {
      if (searchPlayer && !player.nickname.toLowerCase().includes(searchPlayer.toLowerCase())) {
        return false;
      }
      if (filterTeamId && player.team?.team_id !== filterTeamId) {
        return false;
      }
      return true;
    })
    .map((player) => {
      const datePoints = dates.map((dateKey) => {
        if (!isPlayerActiveOnDate(player, dateKey)) return null;

        const dayData = playerDatePoints[player.player_id]?.[dateKey];
        return dayData ? dayData.points : 0;
      });

      const total = datePoints.reduce((sum, points) => sum + (points || 0), 0);

      return {
        player_id: player.player_id,
        nickname: player.nickname,
        team: player.team?.name || "-",
        team_id: player.team?.team_id,
        team_logo: player.team?.logo,
        jersey_no: player.jersey_no || 99,
        datePoints,
        total,
      };
    })
    .sort((left, right) => {
      if (left.team !== right.team) {
        return left.team.localeCompare(right.team);
      }
      return left.jersey_no - right.jersey_no;
    });

  return {
    dates,
    rows,
    rounds,
    excludedPlayerIds,
  };
}
