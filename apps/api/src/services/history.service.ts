import { TRPCError } from '@trpc/server';
import type { PrismaService } from '../prisma/prisma.service';
import {
  isInterimDayCompleted,
  isInterimDayFailed,
} from '../utils/day-completion';

export type HistoryFilters = {
  activityId?: string;
  dateFrom?: Date;
  dateTo?: Date;
};

export type HistoryTaskEntry = {
  type: 'task';
  id: string;
  date: Date;
  dayNumber: number | null;
  activityId: string;
  title: string;
  emoji: string | null;
  seedKey: string | null;
  completedAt: Date | null;
  proofUrl: string | null;
  aiVerdict: string | null;
  isValid: boolean;
  attemptNumber: number;
};

export type HistoryDayEntry = {
  type: 'day';
  id: string;
  date: Date;
  dayNumber: number;
  completed: boolean;
  failReason: string | null;
  attemptNumber: number;
};

export type HistoryEntry = HistoryTaskEntry | HistoryDayEntry;

export type HistoryActivityFilter = {
  activityId: string;
  title: string;
  emoji: string | null;
  seedKey: string | null;
};

export type HistoryListResult = {
  entries: HistoryEntry[];
  availableFilters: HistoryActivityFilter[];
};

export type HistoryLogRow = {
  id: string;
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
  dayNumber: number | null;
};

export function isPassingAiVerdict(aiVerdict: string | null): boolean {
  return aiVerdict !== 'FAILED' && aiVerdict !== 'ERROR';
}

export function resolveDayFailReason(groupId: string | null): string {
  return groupId
    ? 'Not all scored activities were logged'
    : 'Not all personal activities were logged';
}

export function extractHistoryFilters(
  logs: HistoryLogRow[],
): HistoryActivityFilter[] {
  const seen = new Map<string, HistoryActivityFilter>();

  for (const log of logs) {
    const activityId = log.activity.id;
    if (seen.has(activityId)) continue;
    seen.set(activityId, {
      activityId,
      title: log.activity.title,
      emoji: log.activity.emoji,
      seedKey: log.activity.seedKey,
    });
  }

  return [...seen.values()].sort((a, b) => a.title.localeCompare(b.title));
}

export async function listHistory(
  prisma: PrismaService,
  userId: string,
  filters: HistoryFilters = {},
): Promise<HistoryListResult> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
  }

  const dateFilter: { gte?: Date; lte?: Date } = {};
  if (filters.dateFrom) dateFilter.gte = filters.dateFrom;
  if (filters.dateTo) dateFilter.lte = filters.dateTo;

  const activityLogs = await prisma.activityLog.findMany({
    where: {
      userId,
      ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {}),
    },
    orderBy: [{ date: 'desc' }],
    include: {
      activity: {
        select: { id: true, seedKey: true, title: true, emoji: true },
      },
      challenge: {
        select: {
          dayScores: {
            select: { date: true, dayNumber: true },
          },
        },
      },
    },
  });

  const dayScores = await prisma.dayScore.findMany({
    where: {
      challenge: { userId },
      ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {}),
    },
    orderBy: { date: 'desc' },
  });

  const rows: HistoryLogRow[] = activityLogs.map((log) => {
    const dayScore = log.challenge.dayScores.find(
      (ds) => ds.date.getTime() === log.date.getTime(),
    );
    return {
      id: log.id,
      date: log.date,
      proofUrl: log.proofUrl,
      aiVerdict: log.aiVerdict,
      state: log.state,
      activity: log.activity,
      dayNumber: dayScore?.dayNumber ?? null,
    };
  });

  const availableFilters = extractHistoryFilters(rows);

  const filteredRows = filters.activityId
    ? rows.filter((row) => row.activity.id === filters.activityId)
    : rows;

  const entries: HistoryEntry[] = [];

  for (const log of filteredRows) {
    entries.push({
      type: 'task',
      id: log.id,
      date: log.date,
      dayNumber: log.dayNumber,
      activityId: log.activity.id,
      title: log.activity.title,
      emoji: log.activity.emoji,
      seedKey: log.activity.seedKey,
      completedAt: log.state === 'DONE' ? log.date : null,
      proofUrl: log.proofUrl,
      aiVerdict: log.aiVerdict,
      isValid: log.state === 'DONE' && isPassingAiVerdict(log.aiVerdict),
      attemptNumber: 1,
    });
  }

  for (const day of dayScores) {
    entries.push({
      type: 'day',
      id: day.id,
      date: day.date,
      dayNumber: day.dayNumber,
      completed: isInterimDayCompleted(day),
      failReason: isInterimDayFailed(day)
        ? resolveDayFailReason(user.groupId)
        : null,
      attemptNumber: 1,
    });
  }

  entries.sort((a, b) => b.date.getTime() - a.date.getTime());

  return { entries, availableFilters };
}

function escapeCsv(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function exportHistoryCsv(
  prisma: PrismaService,
  userId: string,
  filters: HistoryFilters = {},
): Promise<string> {
  const { entries } = await listHistory(prisma, userId, filters);

  const headers = [
    'Type',
    'Date',
    'Day Number',
    'Activity',
    'Completed',
    'Fail Reason',
    'Challenge',
    'AI Verdict',
    'Proof URL',
  ];

  const rows = entries.map((entry) => {
    if (entry.type === 'task') {
      const activityLabel = entry.emoji
        ? `${entry.emoji} ${entry.title}`
        : entry.title;
      return [
        'task',
        entry.date.toISOString(),
        entry.dayNumber ?? '',
        activityLabel,
        entry.isValid ? 'yes' : 'no',
        '',
        entry.attemptNumber,
        entry.aiVerdict ?? '',
        entry.proofUrl ?? '',
      ];
    }

    return [
      'day',
      entry.date.toISOString(),
      entry.dayNumber,
      '',
      entry.completed ? 'yes' : 'no',
      entry.failReason ?? '',
      entry.attemptNumber,
      '',
      '',
    ];
  });

  return [headers, ...rows]
    .map((row) => row.map(escapeCsv).join(','))
    .join('\n');
}
