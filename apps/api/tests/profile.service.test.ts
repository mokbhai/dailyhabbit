import { describe, expect, it } from 'vitest';
import { rekeyCurrentDayForTimezoneChange } from '../src/services/profile.service';
import { addLocalDays, getUserLocalDate } from '../src/utils/day-window';

const USER_ID = 'user-1';
const CHALLENGE_ID = 'challenge-1';
const ACTIVITY_ID = 'activity-1';

type StoredActivityLog = {
  id: string;
  challengeId: string;
  userId: string;
  activityId: string;
  date: Date;
  value: number | null;
  tier: string | null;
  subPoints: unknown;
  state: string | null;
  xpAwarded: number;
  proofUrl: string | null;
  aiVerdict: string | null;
};

type StoredDayScore = {
  id: string;
  challengeId: string;
  userId: string;
  date: Date;
  dayNumber: number;
  xpEarned: number;
  xpDeducted: number;
  netXp: number;
  personalXp: number;
  breakdown: unknown;
  finalized: boolean;
};

function createRekeyFakePrisma(seed: {
  activityLogs: StoredActivityLog[];
  dayScores: StoredDayScore[];
}) {
  const activityLogs = new Map(seed.activityLogs.map((log) => [log.id, log]));
  const dayScores = new Map(seed.dayScores.map((score) => [score.id, score]));

  function findLogByKey(challengeId: string, activityId: string, date: Date) {
    return (
      [...activityLogs.values()].find(
        (log) =>
          log.challengeId === challengeId &&
          log.activityId === activityId &&
          log.date.getTime() === date.getTime(),
      ) ?? null
    );
  }

  function findScoreByKey(challengeId: string, date: Date) {
    return (
      [...dayScores.values()].find(
        (score) =>
          score.challengeId === challengeId &&
          score.date.getTime() === date.getTime(),
      ) ?? null
    );
  }

  const prisma = {
    activityLog: {
      findMany: async ({
        where,
      }: {
        where: { challengeId: string; userId: string; date: Date };
      }) =>
        [...activityLogs.values()].filter(
          (log) =>
            log.challengeId === where.challengeId &&
            log.userId === where.userId &&
            log.date.getTime() === where.date.getTime(),
        ),
      findUnique: async ({
        where,
      }: {
        where: {
          challengeId_activityId_date: {
            challengeId: string;
            activityId: string;
            date: Date;
          };
        };
      }) =>
        findLogByKey(
          where.challengeId_activityId_date.challengeId,
          where.challengeId_activityId_date.activityId,
          where.challengeId_activityId_date.date,
        ),
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<StoredActivityLog>;
      }) => {
        const log = activityLogs.get(where.id);
        if (!log) throw new Error(`Missing activity log ${where.id}`);
        const updated = { ...log, ...data };
        activityLogs.set(where.id, updated);
        return updated;
      },
      delete: async ({ where }: { where: { id: string } }) => {
        const log = activityLogs.get(where.id);
        if (!log) throw new Error(`Missing activity log ${where.id}`);
        activityLogs.delete(where.id);
        return log;
      },
    },
    dayScore: {
      findFirst: async ({
        where,
      }: {
        where: {
          challengeId: string;
          userId: string;
          date: Date;
          finalized: boolean;
        };
      }) =>
        [...dayScores.values()].find(
          (score) =>
            score.challengeId === where.challengeId &&
            score.userId === where.userId &&
            score.date.getTime() === where.date.getTime() &&
            score.finalized === where.finalized,
        ) ?? null,
      findUnique: async ({
        where,
      }: {
        where: { challengeId_date: { challengeId: string; date: Date } };
      }) =>
        findScoreByKey(
          where.challengeId_date.challengeId,
          where.challengeId_date.date,
        ),
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<StoredDayScore>;
      }) => {
        const score = dayScores.get(where.id);
        if (!score) throw new Error(`Missing day score ${where.id}`);
        const updated = { ...score, ...data };
        dayScores.set(where.id, updated);
        return updated;
      },
      delete: async ({ where }: { where: { id: string } }) => {
        const score = dayScores.get(where.id);
        if (!score) throw new Error(`Missing day score ${where.id}`);
        dayScores.delete(where.id);
        return score;
      },
    },
  };

  return { prisma, activityLogs, dayScores };
}

describe('rekeyCurrentDayForTimezoneChange', () => {
  it('moves the in-flight day rows across a mid-day timezone change and back', async () => {
    const now = new Date('2026-01-15T10:00:00.000Z');
    const oldTimezone = 'Asia/Kolkata';
    const newTimezone = 'America/New_York';
    const oldDate = getUserLocalDate(oldTimezone, now);
    const newDate = getUserLocalDate(newTimezone, now);
    const fake = createRekeyFakePrisma({
      activityLogs: [
        {
          id: 'log-1',
          challengeId: CHALLENGE_ID,
          userId: USER_ID,
          activityId: ACTIVITY_ID,
          date: oldDate,
          value: null,
          tier: null,
          subPoints: null,
          state: 'DONE',
          xpAwarded: 200,
          proofUrl: '/uploads/proof.jpg',
          aiVerdict: 'PASSED',
        },
      ],
      dayScores: [
        {
          id: 'score-1',
          challengeId: CHALLENGE_ID,
          userId: USER_ID,
          date: oldDate,
          dayNumber: 15,
          xpEarned: 200,
          xpDeducted: 0,
          netXp: 200,
          personalXp: 0,
          breakdown: { allScoredLogged: true, entries: [] },
          finalized: false,
        },
      ],
    });

    await rekeyCurrentDayForTimezoneChange(fake.prisma as never, {
      userId: USER_ID,
      challengeId: CHALLENGE_ID,
      oldTimezone,
      newTimezone,
      now,
    });

    expect([...fake.activityLogs.values()][0]?.date.getTime()).toBe(
      newDate.getTime(),
    );
    expect([...fake.dayScores.values()][0]?.date.getTime()).toBe(
      newDate.getTime(),
    );

    const nextLocalMidnight = new Date('2026-01-16T05:00:00.000Z');
    const finalizerPreviousDay = addLocalDays(
      getUserLocalDate(newTimezone, nextLocalMidnight),
      -1,
      newTimezone,
    );
    expect(finalizerPreviousDay.getTime()).toBe(newDate.getTime());

    await rekeyCurrentDayForTimezoneChange(fake.prisma as never, {
      userId: USER_ID,
      challengeId: CHALLENGE_ID,
      oldTimezone: newTimezone,
      newTimezone: oldTimezone,
      now,
    });

    expect([...fake.activityLogs.values()][0]?.date.getTime()).toBe(
      oldDate.getTime(),
    );
    expect([...fake.dayScores.values()][0]?.date.getTime()).toBe(
      oldDate.getTime(),
    );
  });
});
