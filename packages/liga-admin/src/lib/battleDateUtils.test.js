import { describe, test, expect } from 'vitest';
import {
  getBattleDateKey,
  scoreBattleQuality,
  selectBestBattle,
  isBattleQualityAcceptable,
  getDisplayTimeFromCutoff,
  isWithinTimeWindow
} from './battleDateUtils';

describe('battleDateUtils', () => {
  describe('getBattleDateKey', () => {
    test('battle before cutoff counts as previous day', () => {
      // 09:45 UTC on Feb 28 with 590min cutoff (09:50) → Feb 27
      expect(getBattleDateKey('2026-02-28T09:45:00Z', 590)).toBe('2026-02-27');
    });

    test('battle after cutoff counts as same day', () => {
      // 10:05 UTC on Feb 28 with 590min cutoff → Feb 28
      expect(getBattleDateKey('2026-02-28T10:05:00Z', 590)).toBe('2026-02-28');
    });

    test('battle exactly at cutoff counts as same day', () => {
      // 09:50 UTC on Feb 28 with 590min cutoff → Feb 28
      expect(getBattleDateKey('2026-02-28T09:50:00Z', 590)).toBe('2026-02-28');
    });

    test('midnight UTC (before cutoff)', () => {
      // 00:00 UTC on Feb 28 with 590min cutoff → previous day
      expect(getBattleDateKey('2026-02-28T00:00:00Z', 590)).toBe('2026-02-27');
    });

    test('custom cutoff (5 hours = 300 minutes)', () => {
      // 04:30 UTC on Feb 28 with 300min cutoff (05:00) → Feb 27
      expect(getBattleDateKey('2026-02-28T04:30:00Z', 300)).toBe('2026-02-27');
      // 05:15 UTC on Feb 28 with 300min cutoff → Feb 28
      expect(getBattleDateKey('2026-02-28T05:15:00Z', 300)).toBe('2026-02-28');
    });

    test('zero cutoff (no offset)', () => {
      // Battle date is exactly the timestamp date with zero cutoff
      expect(getBattleDateKey('2026-02-28T14:30:00Z', 0)).toBe('2026-02-28');
      expect(getBattleDateKey('2026-02-28T00:00:00Z', 0)).toBe('2026-02-28');
    });

    test('month boundary', () => {
      // 2026-02-01 09:45 UTC with 590min cutoff → 2026-01-31
      expect(getBattleDateKey('2026-02-01T09:45:00Z', 590)).toBe('2026-01-31');
    });

    test('year boundary', () => {
      // 2026-01-01 09:45 UTC with 590min cutoff → 2025-12-31
      expect(getBattleDateKey('2026-01-01T09:45:00Z', 590)).toBe('2025-12-31');
    });

    test('full day cutoff (1440 minutes = 24 hours)', () => {
      // All battles count as previous day with 1440min cutoff
      expect(getBattleDateKey('2026-02-28T23:59:00Z', 1440)).toBe('2026-02-27');
      expect(getBattleDateKey('2026-02-28T00:01:00Z', 1440)).toBe('2026-02-27');
    });
  });

  describe('scoreBattleQuality', () => {
    const scheduledFrom = '2026-02-28T08:00:00Z';
    const scheduledTo = '2026-02-28T20:00:00Z';

    test('perfect battle scores ~100', () => {
      const battle = {
        battle_id: 1,
        battle_time: '2026-02-28T14:00:00Z', // Midpoint
        round_count: 3,
        raw_payload: { team: [{ name: 'Deck1' }] }
      };

      const score = scoreBattleQuality(battle, scheduledFrom, scheduledTo, 590, 3);
      expect(score.total).toBeGreaterThan(80); // High quality match
      expect(score.breakdown.proximity).toBe(40); // At midpoint
      expect(score.breakdown.completeness).toBe(30); // 3/3 rounds
      expect(score.breakdown.windowFit).toBe(20); // Within window + correct date
      expect(score.breakdown.deckValidity).toBe(10); // Has deck data
    });

    test('incomplete battle scores lower', () => {
      const battle = {
        battle_id: 2,
        battle_time: '2026-02-28T14:00:00Z',
        round_count: 1, // Only 1/3 rounds
        raw_payload: { team: [] }
      };

      const score = scoreBattleQuality(battle, scheduledFrom, scheduledTo, 590, 3);
      expect(score.total).toBeLessThan(80);
      expect(score.breakdown.completeness).toBeLessThan(15); // 30 * (1/3)
    });

    test('battle at edge of window', () => {
      const battle = {
        battle_id: 3,
        battle_time: '2026-02-28T08:15:00Z', // Near start
        round_count: 3,
        raw_payload: { team: [] }
      };

      const score = scoreBattleQuality(battle, scheduledFrom, scheduledTo, 590, 3);
      expect(score.breakdown.proximity).toBeLessThan(40); // Not at midpoint
      expect(score.total).toBeGreaterThan(50);
    });

    test('battle without deck data scores lower', () => {
      const battle = {
        battle_id: 4,
        battle_time: '2026-02-28T14:00:00Z',
        round_count: 3,
        raw_payload: {} // No team data
      };

      const score = scoreBattleQuality(battle, scheduledFrom, scheduledTo, 590, 3);
      expect(score.breakdown.deckValidity).toBe(0);
      expect(score.total).toBeLessThan(90);
    });

    test('best_of=1 allows any round_count', () => {
      const battle = {
        battle_id: 5,
        battle_time: '2026-02-28T14:00:00Z',
        round_count: 5, // More than best_of=1
        raw_payload: { team: [] }
      };

      const score = scoreBattleQuality(battle, scheduledFrom, scheduledTo, 590, 1);
      expect(score.breakdown.completeness).toBe(30); // Capped at bestOf ratio
    });
  });

  describe('selectBestBattle', () => {
    const scheduledFrom = '2026-02-28T08:00:00Z';
    const scheduledTo = '2026-02-28T20:00:00Z';

    test('single candidate returns with SINGLE_CANDIDATE reason', () => {
      const candidates = [
        {
          battle_id: 1,
          battle_time: '2026-02-28T10:00:00Z',
          round_count: 3,
          raw_payload: { team: [] }
        }
      ];

      const result = selectBestBattle(candidates, scheduledFrom, scheduledTo, 590, 3);

      expect(result).not.toBeNull();
      expect(result.reason).toBe('SINGLE_CANDIDATE');
      expect(result.battle.battle_id).toBe(1);
    });

    test('empty array returns null', () => {
      const result = selectBestBattle([], scheduledFrom, scheduledTo, 590, 3);
      expect(result).toBeNull();
    });

    test('selects higher-scoring battle', () => {
      const candidates = [
        {
          battle_id: 1,
          battle_time: '2026-02-28T09:45:00Z', // Edge, incomplete
          round_count: 1,
          raw_payload: {}
        },
        {
          battle_id: 2,
          battle_time: '2026-02-28T14:00:00Z', // Midpoint, complete
          round_count: 3,
          raw_payload: { team: [] }
        }
      ];

      const result = selectBestBattle(candidates, scheduledFrom, scheduledTo, 590, 3);

      expect(result.battle.battle_id).toBe(2);
      expect(result.reason).toBe('CLEAR_WINNER');
      expect(result.alternatives.length).toBe(1);
      expect(result.alternatives[0].battle_id).toBe(1);
    });

    test('close call when scores differ by <5 points', () => {
      const candidates = [
        {
          battle_id: 1,
          battle_time: '2026-02-28T13:55:00Z',
          round_count: 3,
          raw_payload: { team: [] }
        },
        {
          battle_id: 2,
          battle_time: '2026-02-28T14:05:00Z',
          round_count: 3,
          raw_payload: { team: [] }
        }
      ];

      const result = selectBestBattle(candidates, scheduledFrom, scheduledTo, 590, 3);

      expect(result.reason).toBe('CLOSE_CALL');
      expect(result.alternatives.length).toBeGreaterThan(0);
    });
  });

  describe('isBattleQualityAcceptable', () => {
    test('score above threshold is acceptable', () => {
      expect(isBattleQualityAcceptable(98, 30)).toBe(true);
      expect(isBattleQualityAcceptable(50, 30)).toBe(true);
      expect(isBattleQualityAcceptable(30, 30)).toBe(true);
    });

    test('score below threshold is not acceptable', () => {
      expect(isBattleQualityAcceptable(29, 30)).toBe(false);
      expect(isBattleQualityAcceptable(0, 30)).toBe(false);
      expect(isBattleQualityAcceptable(15, 30)).toBe(false);
    });

    test('default threshold is 30', () => {
      expect(isBattleQualityAcceptable(31)).toBe(true);
      expect(isBattleQualityAcceptable(29)).toBe(false);
    });
  });

  describe('getDisplayTimeFromCutoff', () => {
    test('590 minutes = 09:50', () => {
      expect(getDisplayTimeFromCutoff(590)).toBe('09:50');
    });

    test('420 minutes = 07:00', () => {
      expect(getDisplayTimeFromCutoff(420)).toBe('07:00');
    });

    test('300 minutes = 05:00', () => {
      expect(getDisplayTimeFromCutoff(300)).toBe('05:00');
    });

    test('0 minutes = 00:00', () => {
      expect(getDisplayTimeFromCutoff(0)).toBe('00:00');
    });

    test('1440 minutes = 24:00', () => {
      expect(getDisplayTimeFromCutoff(1440)).toBe('24:00');
    });

    test('60 minutes = 01:00', () => {
      expect(getDisplayTimeFromCutoff(60)).toBe('01:00');
    });

    test('1320 minutes = 22:00', () => {
      expect(getDisplayTimeFromCutoff(1320)).toBe('22:00');
    });
  });

  describe('isWithinTimeWindow', () => {
    test('battle within window', () => {
      expect(
        isWithinTimeWindow('2026-02-28T14:00:00Z', '2026-02-28T08:00:00Z', '2026-02-28T20:00:00Z')
      ).toBe(true);
    });

    test('battle at window start boundary', () => {
      expect(
        isWithinTimeWindow('2026-02-28T08:00:00Z', '2026-02-28T08:00:00Z', '2026-02-28T20:00:00Z')
      ).toBe(true);
    });

    test('battle at window end boundary', () => {
      expect(
        isWithinTimeWindow('2026-02-28T20:00:00Z', '2026-02-28T08:00:00Z', '2026-02-28T20:00:00Z')
      ).toBe(true);
    });

    test('battle before window', () => {
      expect(
        isWithinTimeWindow('2026-02-28T07:00:00Z', '2026-02-28T08:00:00Z', '2026-02-28T20:00:00Z')
      ).toBe(false);
    });

    test('battle after window', () => {
      expect(
        isWithinTimeWindow('2026-02-28T21:00:00Z', '2026-02-28T08:00:00Z', '2026-02-28T20:00:00Z')
      ).toBe(false);
    });
  });
});
