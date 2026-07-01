import { describe, expect, it } from 'vitest';
import { evaluateDayRollover } from '../src/services/day-finalizer';
import { type ScoredActivity } from '../src/services/scoring.service';
import { getMemberStatus } from '../src/utils/member-status';

const scoredCheckbox: ScoredActivity = {
  id: 'checkbox-1',
  kind: 'CHECKBOX',
  scored: true,
  isPersonal: false,
  deductMultiplier: 2,
  xpComplete: 100,
  xpMiss: -100,
};

function makeChallenge(
  overrides: Partial<{
    isActive: boolean;
    currentDay: number;
    lengthDays: number;
    startDate: Date;
    endDate: Date | null;
    stoppedAt: Date | null;
  }> = {},
) {
  return {
    id: 'challenge-1',
    userId: 'user-1',
    groupId: null,
    startDate: new Date('2026-06-01T00:00:00.000Z'),
    endDate: new Date('2026-06-30T00:00:00.000Z'),
    stoppedAt: null,
    lengthDays: 30,
    currentDay: 1,
    isActive: true,
    totalXp: 0,
    currentStreak: 0,
    longestStreak: 0,
    ...overrides,
  };
}

describe('getMemberStatus', () => {
  it('returns ACTIVE for an in-progress challenge', () => {
    expect(
      getMemberStatus(
        makeChallenge({ currentDay: 5, lengthDays: 30 }),
        'UTC',
        new Date('2026-06-05T12:00:00.000Z'),
      ),
    ).toBe('ACTIVE');
  });

  it('returns COMPLETED after the scheduled end date', () => {
    expect(
      getMemberStatus(
        makeChallenge({ currentDay: 30, lengthDays: 30 }),
        'UTC',
        new Date('2026-07-01T00:00:00.000Z'),
      ),
    ).toBe('COMPLETED');
  });

  it('returns COMPLETED when challenge is inactive', () => {
    expect(getMemberStatus(makeChallenge({ isActive: false }))).toBe(
      'COMPLETED',
    );
  });

  it('returns COMPLETED for null challenge', () => {
    expect(getMemberStatus(null)).toBe('COMPLETED');
  });
});

describe('day finalizer streak — non-elimination', () => {
  it('resets streak to 0 on a missed day without restarting the challenge', () => {
    const result = evaluateDayRollover({
      challenge: {
        currentDay: 10,
        lengthDays: 30,
        currentStreak: 9,
        longestStreak: 9,
      },
      scoredActivities: [scoredCheckbox],
      previousDayLogs: [],
    });

    expect(result.challengeUpdate.currentStreak).toBe(0);
    expect(result.challengeUpdate.currentDay).toBe(11);
    expect(result.challengeUpdate.completed).toBe(false);
  });

  it('preserves longestStreak after a streak reset', () => {
    const result = evaluateDayRollover({
      challenge: {
        currentDay: 20,
        lengthDays: 30,
        currentStreak: 5,
        longestStreak: 15,
      },
      scoredActivities: [scoredCheckbox],
      previousDayLogs: [],
    });

    expect(result.challengeUpdate.currentStreak).toBe(0);
    expect(result.challengeUpdate.longestStreak).toBe(15);
  });
});
