import { describe, expect, test } from "vitest";
import {
  applyConsecutiveMissPenalties,
  buildDailyPointsGrid,
  calculateRounds,
  getPenaltyForConsecutiveMisses,
} from "./dailyPointsUtils";

describe("dailyPointsUtils", () => {
  describe("calculateRounds", () => {
    test("groups dates by daysPerRound and handles partial final round", () => {
      const dates = [
        "2026-02-01",
        "2026-02-02",
        "2026-02-03",
        "2026-02-04",
        "2026-02-05",
      ];

      const rounds = calculateRounds(dates, 2);

      expect(rounds).toEqual([
        { number: 1, dates: ["2026-02-01", "2026-02-02"], startIndex: 0, endIndex: 1 },
        { number: 2, dates: ["2026-02-03", "2026-02-04"], startIndex: 2, endIndex: 3 },
        { number: 3, dates: ["2026-02-05"], startIndex: 4, endIndex: 4 },
      ]);
    });
  });

  describe("getPenaltyForConsecutiveMisses", () => {
    test("returns expected penalty scale", () => {
      expect(getPenaltyForConsecutiveMisses(0)).toBe(0);
      expect(getPenaltyForConsecutiveMisses(1)).toBe(-1);
      expect(getPenaltyForConsecutiveMisses(2)).toBe(-2);
      expect(getPenaltyForConsecutiveMisses(3)).toBe(-5);
      expect(getPenaltyForConsecutiveMisses(4)).toBe(-10);
      expect(getPenaltyForConsecutiveMisses(7)).toBe(-10);
    });
  });

  describe("applyConsecutiveMissPenalties", () => {
    test("tracks misses, resets after played date, and excludes after 4 misses", () => {
      const result = applyConsecutiveMissPenalties({
        scheduledDates: [
          "2026-02-01",
          "2026-02-02",
          "2026-02-03",
          "2026-02-04",
          "2026-02-05",
          "2026-02-06",
        ],
        playedDatesSet: new Set(["2026-02-03"]),
        isActiveOnDate: () => true,
        todayDateKey: "2026-02-06",
      });

      expect(result.penaltiesByDate["2026-02-01"]).toEqual({ points: -1, missCount: 1 });
      expect(result.penaltiesByDate["2026-02-02"]).toEqual({ points: -2, missCount: 2 });
      expect(result.penaltiesByDate["2026-02-04"]).toEqual({ points: -1, missCount: 1 });
      expect(result.penaltiesByDate["2026-02-05"]).toEqual({ points: -2, missCount: 2 });
      expect(result.penaltiesByDate["2026-02-06"]).toEqual({ points: -5, missCount: 3 });
      expect(result.excluded).toBe(false);
    });
  });

  describe("buildDailyPointsGrid", () => {
    const baseSeason = {
      duel_start_date: "2026-02-01",
      season_end_at: "2026-02-20T00:00:00Z",
      days_per_round: 2,
    };

    const basePlayers = [
      {
        player_id: "p1",
        nickname: "Alpha",
        team: { team_id: "t1", name: "Team A" },
        jersey_no: 1,
        start_date: "2026-02-01",
        end_date: null,
      },
      {
        player_id: "p2",
        nickname: "Beta",
        team: { team_id: "t1", name: "Team A" },
        jersey_no: 2,
        start_date: "2026-02-02",
        end_date: "2026-02-03",
      },
    ];

    test("renders round headers and includes penalties in total", () => {
      const matches = [
        { player_a_id: "p1", scheduled_from: "2026-02-01T12:00:00Z", result: { points_a: 3 } },
        { player_a_id: "p1", scheduled_from: "2026-02-02T12:00:00Z", result: null },
        { player_a_id: "p1", scheduled_from: "2026-02-03T12:00:00Z", result: { points_a: 2 } },
        { player_a_id: "p1", scheduled_from: "2026-02-04T12:00:00Z", result: null },
      ];

      const grid = buildDailyPointsGrid({
        season: baseSeason,
        matches,
        players: basePlayers,
        searchPlayer: "",
        filterTeamId: "",
        battleCutoffMinutes: 0,
        todayDateKey: "2026-02-05",
      });

      expect(grid.rounds).toHaveLength(2);
      expect(grid.rounds[0].dates).toEqual(["2026-02-01", "2026-02-02"]);
      expect(grid.rounds[1].dates).toEqual(["2026-02-03", "2026-02-04"]);

      const alpha = grid.rows.find((row) => row.player_id === "p1");
      expect(alpha.datePoints).toEqual([3, -1, 2, -1]);
      expect(alpha.total).toBe(3);
    });

    test("handles player join/leave windows and excludes player after 4 misses", () => {
      const playersWithLongActiveWindow = [
        ...basePlayers,
        {
          player_id: "p3",
          nickname: "Gamma",
          team: { team_id: "t2", name: "Team B" },
          jersey_no: 3,
          start_date: "2026-02-01",
          end_date: null,
        },
      ];

      const matches = [
        { player_a_id: "p3", scheduled_from: "2026-02-01T12:00:00Z", result: null },
        { player_a_id: "p3", scheduled_from: "2026-02-02T12:00:00Z", result: null },
        { player_a_id: "p3", scheduled_from: "2026-02-03T12:00:00Z", result: null },
        { player_a_id: "p3", scheduled_from: "2026-02-04T12:00:00Z", result: null },
        { player_a_id: "p1", scheduled_from: "2026-02-01T12:00:00Z", result: { points_a: 1 } },
      ];

      const grid = buildDailyPointsGrid({
        season: baseSeason,
        matches,
        players: playersWithLongActiveWindow,
        searchPlayer: "",
        filterTeamId: "",
        battleCutoffMinutes: 0,
        todayDateKey: "2026-02-06",
      });

      expect(grid.rows.some((row) => row.player_id === "p3")).toBe(false);
      expect(grid.excludedPlayerIds.has("p3")).toBe(true);

      const alpha = grid.rows.find((row) => row.player_id === "p1");
      expect(alpha).toBeTruthy();
    });

    test("stops penalties after end_date and only starts after start_date", () => {
      const matches = [
        { player_a_id: "p2", scheduled_from: "2026-02-01T12:00:00Z", result: null },
        { player_a_id: "p2", scheduled_from: "2026-02-02T12:00:00Z", result: null },
        { player_a_id: "p2", scheduled_from: "2026-02-03T12:00:00Z", result: { points_a: 4 } },
        { player_a_id: "p2", scheduled_from: "2026-02-04T12:00:00Z", result: null },
      ];

      const grid = buildDailyPointsGrid({
        season: baseSeason,
        matches,
        players: basePlayers,
        searchPlayer: "Beta",
        filterTeamId: "",
        battleCutoffMinutes: 0,
        todayDateKey: "2026-02-05",
      });

      const beta = grid.rows.find((row) => row.player_id === "p2");
      expect(beta).toBeTruthy();

      // 02-01 is before start_date (inactive => null), 02-02 miss => -1, 02-03 played => 4, 02-04 after end_date => null
      expect(beta.datePoints).toEqual([null, -1, 4, null]);
      expect(beta.total).toBe(3);
    });

    test("uses 4-day round fallback when season.days_per_round is missing", () => {
      const seasonWithoutDaysPerRound = {
        duel_start_date: "2026-02-01",
        season_end_at: "2026-02-12T00:00:00Z",
      };

      const matches = Array.from({ length: 8 }).map((_, index) => ({
        player_a_id: "p1",
        scheduled_from: `2026-02-${String(index + 1).padStart(2, "0")}T12:00:00Z`,
        result: { points_a: 1 },
      }));

      const grid = buildDailyPointsGrid({
        season: seasonWithoutDaysPerRound,
        matches,
        players: basePlayers,
        searchPlayer: "",
        filterTeamId: "",
        battleCutoffMinutes: 0,
        todayDateKey: "2026-02-10",
      });

      expect(grid.rounds).toHaveLength(2);
      expect(grid.rounds[0].dates).toHaveLength(4);
      expect(grid.rounds[1].dates).toHaveLength(4);
    });

    test("processes large dataset under 2 seconds", () => {
      const season = {
        duel_start_date: "2026-02-01",
        season_end_at: "2026-03-31T00:00:00Z",
        days_per_round: 5,
      };

      const players = Array.from({ length: 200 }).map((_, index) => ({
        player_id: `player-${index + 1}`,
        nickname: `Player ${index + 1}`,
        team: { team_id: `team-${(index % 10) + 1}`, name: `Team ${(index % 10) + 1}` },
        jersey_no: index + 1,
        start_date: "2026-02-01",
        end_date: null,
      }));

      const dates = Array.from({ length: 50 }).map((_, index) =>
        `2026-02-${String((index % 28) + 1).padStart(2, "0")}`
      );

      const matches = [];
      players.forEach((player, playerIndex) => {
        dates.forEach((dateKey, dateIndex) => {
          matches.push({
            player_a_id: player.player_id,
            scheduled_from: `${dateKey}T12:00:00Z`,
            result:
              (playerIndex + dateIndex) % 4 === 0
                ? null
                : { points_a: ((playerIndex + dateIndex) % 5) + 1 },
          });
        });
      });

      const startedAt = performance.now();
      const grid = buildDailyPointsGrid({
        season,
        matches,
        players,
        searchPlayer: "",
        filterTeamId: "",
        battleCutoffMinutes: 0,
        todayDateKey: "2026-03-31",
      });
      const durationMs = performance.now() - startedAt;

      expect(grid.dates.length).toBeGreaterThanOrEqual(28);
      expect(grid.rows.length).toBeGreaterThan(0);
      expect(durationMs).toBeLessThan(2000);
    });
  });
});
