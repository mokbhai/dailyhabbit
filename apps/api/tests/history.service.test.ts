import { describe, expect, it, vi } from 'vitest';
import {
  exportHistoryCsv,
  extractHistoryFilters,
  isPassingAiVerdict,
  listHistory,
  resolveDayFailReason,
  type HistoryLogRow,
} from '../src/services/history.service';
import type { PrismaService } from '../src/prisma/prisma.service';

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
  const dayOne = new Date('2026-06-01T00:00:00.000Z');

  it('deduplicates activities by activityId and sorts by title', () => {
    const logs: HistoryLogRow[] = [
      {
        id: 'log-1',
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
        dayNumber: 1,
      },
      {
        id: 'log-2',
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
        dayNumber: 1,
      },
      {
        id: 'log-3',
        date: dayOne,
        proofUrl: null,
        aiVerdict: null,
        state: 'DONE',
        activity: {
          id: 'act-custom',
          seedKey: 'CUSTOM_STRETCH',
          title: 'Morning Stretch',
          emoji: '🧘',
        },
        dayNumber: 1,
      },
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
      {
        id: 'log-personal',
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
        dayNumber: 1,
      },
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

const USER_ID = 'user-history';

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
        logs.filter((log) => log.userId === where.userId),
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
});
