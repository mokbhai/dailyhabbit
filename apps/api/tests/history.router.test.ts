import { describe, expect, it, vi } from 'vitest';
import { historyRouter } from '../src/trpc/routers/history.router';
import type { Context } from '../src/trpc/context';

const USER_ID = 'user-history';
const OTHER_ID = 'user-other';

type StoredLog = {
  id: string;
  userId: string;
  date: Date;
  proofUrl: string | null;
  aiVerdict: string | null;
  state: string | null;
  activity: {
    id: string;
    seedKey: string | null;
    title: string;
    emoji: string | null;
  };
  challenge: {
    dayScores: Array<{ date: Date; dayNumber: number }>;
  };
};

function createHistoryContext(logs: StoredLog[]): Context {
  const prisma = {
    user: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
        where.id === USER_ID ? { id: USER_ID, groupId: null } : null,
      ),
    },
    activityLog: {
      findMany: vi.fn(async ({ where }: { where: { userId: string } }) =>
        logs.filter((log) => log.userId === where.userId),
      ),
    },
    dayScore: {
      findMany: vi.fn(async () => []),
    },
  };

  return {
    req: { headers: {} } as Context['req'],
    res: {} as Context['res'],
    user: { id: USER_ID, email: null, phone: null, name: 'History User' },
    prisma: prisma as unknown as Context['prisma'],
    authService: {} as Context['authService'],
    activitiesService: {} as Context['activitiesService'],
    guidanceService: {} as Context['guidanceService'],
  };
}

describe('historyRouter.list', () => {
  it('returns enriched task entries and availableFilters', async () => {
    const dayOne = new Date('2026-06-01T00:00:00.000Z');

    const logs: StoredLog[] = [
      {
        id: 'log-custom',
        userId: USER_ID,
        date: dayOne,
        proofUrl: null,
        aiVerdict: 'PASSED',
        state: 'DONE',
        activity: {
          id: 'act-custom',
          seedKey: 'CUSTOM_STRETCH',
          title: 'Morning Stretch',
          emoji: '🧘',
        },
        challenge: {
          dayScores: [{ date: dayOne, dayNumber: 1 }],
        },
      },
      {
        id: 'log-personal',
        userId: USER_ID,
        date: dayOne,
        proofUrl: null,
        aiVerdict: null,
        state: 'DONE',
        activity: {
          id: 'act-personal',
          seedKey: null,
          title: 'My Journal',
          emoji: '📓',
        },
        challenge: { dayScores: [{ date: dayOne, dayNumber: 1 }] },
      },
      {
        id: 'other-user-log',
        userId: OTHER_ID,
        date: dayOne,
        proofUrl: null,
        aiVerdict: null,
        state: 'DONE',
        activity: {
          id: 'act-other',
          seedKey: 'WATER',
          title: 'Water',
          emoji: '💧',
        },
        challenge: { dayScores: [] },
      },
    ];

    const caller = historyRouter.createCaller(createHistoryContext(logs));
    const result = await caller.list();

    const tasks = result.entries.filter((e) => e.type === 'task');
    expect(tasks).toHaveLength(2);
    expect(tasks[0]).toMatchObject({
      activityId: 'act-custom',
      title: 'Morning Stretch',
      emoji: '🧘',
      seedKey: 'CUSTOM_STRETCH',
      aiVerdict: 'PASSED',
    });
    expect(result.availableFilters).toEqual([
      {
        activityId: 'act-custom',
        title: 'Morning Stretch',
        emoji: '🧘',
        seedKey: 'CUSTOM_STRETCH',
      },
      {
        activityId: 'act-personal',
        title: 'My Journal',
        emoji: '📓',
        seedKey: null,
      },
    ]);
  });

  it('applies activityId filter through listHistory', async () => {
    const dayOne = new Date('2026-06-01T00:00:00.000Z');

    const logs: StoredLog[] = [
      {
        id: 'log-water',
        userId: USER_ID,
        date: dayOne,
        proofUrl: null,
        aiVerdict: null,
        state: 'DONE',
        activity: {
          id: 'act-water',
          seedKey: 'WATER',
          title: 'Water',
          emoji: '💧',
        },
        challenge: { dayScores: [{ date: dayOne, dayNumber: 1 }] },
      },
      {
        id: 'log-reading',
        userId: USER_ID,
        date: dayOne,
        proofUrl: null,
        aiVerdict: null,
        state: 'DONE',
        activity: {
          id: 'act-reading',
          seedKey: 'READING',
          title: 'Reading',
          emoji: '📚',
        },
        challenge: { dayScores: [{ date: dayOne, dayNumber: 1 }] },
      },
    ];

    const caller = historyRouter.createCaller(createHistoryContext(logs));
    const result = await caller.list({ activityId: 'act-reading' });

    const tasks = result.entries.filter((e) => e.type === 'task');
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      activityId: 'act-reading',
      title: 'Reading',
    });
    expect(result.availableFilters).toHaveLength(2);
  });
});
