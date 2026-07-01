import { describe, expect, it, vi } from 'vitest';
import {
  exportHistoryCsv,
  extractHistoryFilters,
  isHistoryTaskCompleted,
  isPassingAiVerdict,
  listHistory,
  resolveDayFailReason,
  type HistoryLogRow,
} from '../src/services/history.service';
import type { PrismaService } from '../src/prisma/prisma.service';

const USER_ID = 'user-history';
const dayOne = new Date('2026-06-01T00:00:00.000Z');

function makeHistoryActivity(
  overrides: Partial<HistoryLogRow['activity']> = {},
): HistoryLogRow['activity'] {
  return {
    id: 'act-checkbox',
    seedKey: 'CHECKBOX',
    title: 'Checkbox',
    emoji: '✅',
    kind: 'CHECKBOX',
    scored: true,
    isPersonal: false,
    deductMultiplier: 2,
    xpComplete: 100,
    xpMiss: -100,
    unitLabel: null,
    xpPerUnit: null,
    xpCap: null,
    missXp: null,
    subPoints: null,
    tiers: null,
    ...overrides,
  };
}

function makeHistoryLogRow(
  overrides: Partial<HistoryLogRow> & {
    activity?: Partial<HistoryLogRow['activity']>;
  } = {},
): HistoryLogRow {
  const { activity, ...rest } = overrides;
  return {
    id: 'log-history',
    date: dayOne,
    proofUrl: null,
    aiVerdict: null,
    state: 'DONE',
    tier: null,
    value: null,
    subPoints: null,
    activity: makeHistoryActivity(activity),
    dayNumber: 1,
    ...rest,
  };
}

describe('resolveDayFailReason', () => {
  it('returns scored copy when the user belongs to a group', () => {
    expect(resolveDayFailReason('g1')).toBe(
      'Not all scored activities were logged',
    );
  });

  it('returns personal copy for personal-only users', () => {
    expect(resolveDayFailReason(null)).toBe(
      'Not all personal activities were logged',
    );
  });
});

describe('isPassingAiVerdict', () => {
  it('treats configured verifier errors as non-passing', () => {
    expect(isPassingAiVerdict('ERROR')).toBe(false);
  });

  it('preserves existing failed and skipped behavior', () => {
    expect(isPassingAiVerdict('FAILED')).toBe(false);
    expect(isPassingAiVerdict('SKIPPED')).toBe(true);
    expect(isPassingAiVerdict(null)).toBe(true);
  });
});

describe('extractHistoryFilters', () => {
  it('deduplicates activities by activityId and sorts by title', () => {
    const logs: HistoryLogRow[] = [
      makeHistoryLogRow({
        id: 'log-1',
        activity: {
          id: 'act-water',
          seedKey: 'WATER',
          title: 'Water',
          emoji: '💧',
          kind: 'NUMBER',
          xpPerUnit: 25,
          xpCap: 100,
          missXp: -100,
        },
      }),
      makeHistoryLogRow({
        id: 'log-2',
        activity: {
          id: 'act-water',
          seedKey: 'WATER',
          title: 'Water',
          emoji: '💧',
          kind: 'NUMBER',
          xpPerUnit: 25,
          xpCap: 100,
          missXp: -100,
        },
      }),
      makeHistoryLogRow({
        id: 'log-3',
        activity: {
          id: 'act-custom',
          seedKey: 'CUSTOM_STRETCH',
          title: 'Morning Stretch',
          emoji: '🧘',
        },
      }),
    ];

    expect(extractHistoryFilters(logs)).toEqual([
      {
        activityId: 'act-custom',
        title: 'Morning Stretch',
        emoji: '🧘',
        seedKey: 'CUSTOM_STRETCH',
      },
      {
        activityId: 'act-water',
        title: 'Water',
        emoji: '💧',
        seedKey: 'WATER',
      },
    ]);
  });

  it('includes personal activities with null seedKey', () => {
    const logs: HistoryLogRow[] = [
      makeHistoryLogRow({
        id: 'log-personal',
        activity: {
          id: 'act-personal',
          seedKey: null,
          title: 'My Journal',
          emoji: '📓',
        },
      }),
    ];

    expect(extractHistoryFilters(logs)).toEqual([
      {
        activityId: 'act-personal',
        title: 'My Journal',
        emoji: '📓',
        seedKey: null,
      },
    ]);
  });
});

type StoredLog = {
  id: string;
  userId: string;
  date: Date;
  proofUrl: string | null;
  aiVerdict: string | null;
  state: string | null;
  tier?: string | null;
  value?: number | null;
  subPoints?: unknown;
  activity: Partial<HistoryLogRow['activity']> &
    Pick<HistoryLogRow['activity'], 'id' | 'seedKey' | 'title' | 'emoji'>;
  challenge: {
    dayScores: Array<{ date: Date; dayNumber: number }>;
  };
};

function createMockPrisma(
  logs: StoredLog[],
  dayScores: Array<{
    id: string;
    date: Date;
    dayNumber: number;
    completed: boolean;
    failed: boolean;
  }> = [],
) {
  return {
    user: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
        where.id === USER_ID ? { id: USER_ID, groupId: null } : null,
      ),
    },
    activityLog: {
      findMany: vi.fn(async ({ where }: { where: { userId: string } }) =>
        logs
          .filter((log) => log.userId === where.userId)
          .map((log) => ({
            ...log,
            tier: log.tier ?? null,
            value: log.value ?? null,
            subPoints: log.subPoints ?? null,
            activity: makeHistoryActivity(log.activity),
          })),
      ),
    },
    dayScore: {
      findMany: vi.fn(async () => dayScores),
    },
  } as unknown as PrismaService;
}

describe('listHistory', () => {
  const dayOne = new Date('2026-06-01T00:00:00.000Z');

  it('returns real activity title for custom seedKey without DIET fallback', async () => {
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
        challenge: { dayScores: [{ date: dayOne, dayNumber: 1 }] },
      },
    ];

    const result = await listHistory(createMockPrisma(logs), USER_ID);

    const task = result.entries.find((e) => e.type === 'task');
    expect(task).toMatchObject({
      type: 'task',
      activityId: 'act-custom',
      title: 'Morning Stretch',
      emoji: '🧘',
      seedKey: 'CUSTOM_STRETCH',
    });
    expect(JSON.stringify(task)).not.toContain('DIET');
  });

  it('includes personal activities with null seedKey in entries and filters', async () => {
    const logs: StoredLog[] = [
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
    ];

    const result = await listHistory(createMockPrisma(logs), USER_ID);

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toMatchObject({
      type: 'task',
      title: 'My Journal',
      emoji: '📓',
      seedKey: null,
    });
    expect(result.availableFilters).toEqual([
      {
        activityId: 'act-personal',
        title: 'My Journal',
        emoji: '📓',
        seedKey: null,
      },
    ]);
  });

  it('narrows task entries when activityId filter is set', async () => {
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
          kind: 'NUMBER',
          xpPerUnit: 25,
          xpCap: 100,
          missXp: -100,
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

    const result = await listHistory(createMockPrisma(logs), USER_ID, {
      activityId: 'act-reading',
    });

    const tasks = result.entries.filter((e) => e.type === 'task');
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      activityId: 'act-reading',
      title: 'Reading',
    });
    expect(result.availableFilters).toHaveLength(2);
  });

  it('marks non-checkbox activity logs valid using derived completion', async () => {
    const logs: StoredLog[] = [
      {
        id: 'log-water',
        userId: USER_ID,
        date: dayOne,
        proofUrl: null,
        aiVerdict: null,
        state: null,
        value: 3,
        activity: {
          id: 'act-water',
          seedKey: 'WATER',
          title: 'Water',
          emoji: '💧',
          kind: 'NUMBER',
          xpPerUnit: 25,
          xpCap: 100,
          missXp: -100,
        },
        challenge: { dayScores: [{ date: dayOne, dayNumber: 1 }] },
      },
      {
        id: 'log-reels',
        userId: USER_ID,
        date: dayOne,
        proofUrl: null,
        aiVerdict: null,
        state: null,
        tier: 'UNDER_60',
        activity: {
          id: 'act-reels',
          seedKey: 'NO_REELS',
          title: 'No Reels',
          emoji: '📱',
          kind: 'TIERED',
          tiers: [
            { key: 'UNDER_60', label: '< 60 min', maxMinutes: 60, xp: 60 },
          ],
        },
        challenge: { dayScores: [{ date: dayOne, dayNumber: 1 }] },
      },
      {
        id: 'log-diet',
        userId: USER_ID,
        date: dayOne,
        proofUrl: null,
        aiVerdict: null,
        state: null,
        subPoints: { HEALTHY: 'DONE', NO_JUNK: 'DONE' },
        activity: {
          id: 'act-diet',
          seedKey: 'DIET',
          title: 'Diet',
          emoji: '🥗',
          kind: 'SUBPOINTS',
          subPoints: [
            { key: 'HEALTHY', label: 'Healthy', xp: 60 },
            { key: 'NO_JUNK', label: 'No junk', xp: 70 },
          ],
        },
        challenge: { dayScores: [{ date: dayOne, dayNumber: 1 }] },
      },
    ];

    const result = await listHistory(createMockPrisma(logs), USER_ID);
    const tasks = result.entries.filter((entry) => entry.type === 'task');

    expect(tasks).toHaveLength(3);
    expect(tasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          activityId: 'act-water',
          completedAt: dayOne,
          isValid: true,
        }),
        expect.objectContaining({
          activityId: 'act-reels',
          completedAt: dayOne,
          isValid: true,
        }),
        expect.objectContaining({
          activityId: 'act-diet',
          completedAt: dayOne,
          isValid: true,
        }),
      ]),
    );
  });
});

describe('exportHistoryCsv', () => {
  const dayOne = new Date('2026-06-01T00:00:00.000Z');

  it('uses the Activity column with the real emoji and title', async () => {
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
        challenge: { dayScores: [{ date: dayOne, dayNumber: 1 }] },
      },
    ];

    const csv = await exportHistoryCsv(createMockPrisma(logs), USER_ID);
    const [header, taskRow] = csv.split('\n');

    expect(header).toContain('Activity');
    expect(header).not.toContain('Task Type');
    expect(taskRow).toContain('🧘 Morning Stretch');
  });

  it('exports derived non-checkbox completion as completed', async () => {
    const logs: StoredLog[] = [
      {
        id: 'log-water',
        userId: USER_ID,
        date: dayOne,
        proofUrl: null,
        aiVerdict: null,
        state: null,
        value: 3,
        activity: {
          id: 'act-water',
          seedKey: 'WATER',
          title: 'Water',
          emoji: '💧',
          kind: 'NUMBER',
          xpPerUnit: 25,
          xpCap: 100,
          missXp: -100,
        },
        challenge: { dayScores: [{ date: dayOne, dayNumber: 1 }] },
      },
    ];

    const csv = await exportHistoryCsv(createMockPrisma(logs), USER_ID);
    const [, taskRow] = csv.split('\n');

    expect(taskRow).toContain('💧 Water');
    expect(taskRow.split(',')[4]).toBe('yes');
  });
});

describe('isHistoryTaskCompleted', () => {
  it('derives completion from non-checkbox payloads', () => {
    expect(
      isHistoryTaskCompleted(
        makeHistoryLogRow({
          state: null,
          value: 3,
          activity: {
            kind: 'NUMBER',
            xpPerUnit: 25,
            xpCap: 100,
            missXp: -100,
          },
        }),
      ),
    ).toBe(true);
    expect(
      isHistoryTaskCompleted(
        makeHistoryLogRow({
          state: null,
          tier: 'UNDER_60',
          activity: {
            kind: 'TIERED',
            tiers: [
              { key: 'UNDER_60', label: '< 60 min', maxMinutes: 60, xp: 60 },
            ],
          },
        }),
      ),
    ).toBe(true);
    expect(
      isHistoryTaskCompleted(
        makeHistoryLogRow({
          state: null,
          subPoints: { HEALTHY: 'DONE', NO_JUNK: 'DONE' },
          activity: {
            kind: 'SUBPOINTS',
            subPoints: [
              { key: 'HEALTHY', label: 'Healthy', xp: 60 },
              { key: 'NO_JUNK', label: 'No junk', xp: 70 },
            ],
          },
        }),
      ),
    ).toBe(true);
  });

  it('does not treat explicit failures or zero number logs as completed', () => {
    expect(
      isHistoryTaskCompleted(
        makeHistoryLogRow({
          state: 'FAILED',
          value: 3,
          activity: {
            kind: 'NUMBER',
            xpPerUnit: 25,
            xpCap: 100,
            missXp: -100,
          },
        }),
      ),
    ).toBe(false);
    expect(
      isHistoryTaskCompleted(
        makeHistoryLogRow({
          state: null,
          value: 0,
          activity: {
            kind: 'NUMBER',
            xpPerUnit: 25,
            xpCap: 100,
            missXp: -100,
          },
        }),
      ),
    ).toBe(false);
    expect(
      isHistoryTaskCompleted(
        makeHistoryLogRow({
          state: null,
          subPoints: { HEALTHY: 'UNLOGGED' },
          activity: {
            kind: 'SUBPOINTS',
            subPoints: [{ key: 'HEALTHY', label: 'Healthy', xp: 60 }],
          },
        }),
      ),
    ).toBe(false);
    expect(
      isHistoryTaskCompleted(
        makeHistoryLogRow({
          state: null,
          subPoints: { HEALTHY: 'DONE', NO_JUNK: 'UNLOGGED' },
          activity: {
            kind: 'SUBPOINTS',
            subPoints: [
              { key: 'HEALTHY', label: 'Healthy', xp: 60 },
              { key: 'NO_JUNK', label: 'No junk', xp: 70 },
            ],
          },
        }),
      ),
    ).toBe(false);
  });
});
