import { TRPCError } from '@trpc/server';
import type { PrismaService } from '../prisma/prisma.service';
import {
  isInterimDayCompleted,
  isInterimDayFailed,
} from '../utils/day-completion';
import {
  computeActivityXp,
  type ActivityKind,
  type ActivityLogInput,
  type ActivityLogState,
  type ScoredActivity,
  type SubPointConfig,
  type TierConfig,
} from './scoring.service';

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
  tier: string | null;
  value: number | null;
  subPoints: unknown;
  activity: {
    id: string;
    seedKey: string | null;
    title: string;
    emoji: string | null;
    kind: ActivityKind;
    scored: boolean;
    isPersonal: boolean;
    deductMultiplier: number;
    xpComplete: number | null;
    xpMiss: number | null;
    unitLabel: string | null;
    xpPerUnit: number | null;
    xpCap: number | null;
    missXp: number | null;
    subPoints: unknown;
    tiers: unknown;
  };
  dayNumber: number | null;
};

export function isPassingAiVerdict(aiVerdict: string | null): boolean {
  return aiVerdict !== 'FAILED' && aiVerdict !== 'ERROR';
}

function mapHistoryActivityToScored(
  activity: HistoryLogRow['activity'],
): ScoredActivity {
  return {
    id: activity.id,
    kind: activity.kind,
    scored: activity.scored,
    isPersonal: activity.isPersonal,
    deductMultiplier: activity.deductMultiplier,
    xpComplete: activity.xpComplete ?? undefined,
    xpMiss: activity.xpMiss ?? undefined,
    unitLabel: activity.unitLabel ?? undefined,
    xpPerUnit: activity.xpPerUnit ?? undefined,
    xpCap: activity.xpCap ?? undefined,
    missXp: activity.missXp ?? undefined,
    subPoints: (activity.subPoints ?? undefined) as
      | SubPointConfig[]
      | undefined,
    tiers: (activity.tiers ?? undefined) as TierConfig[] | undefined,
  };
}

function mapHistoryLogToInput(log: HistoryLogRow): ActivityLogInput {
  return {
    activityId: log.activity.id,
    state: (log.state as ActivityLogState | null) ?? undefined,
    value: log.value,
    tier: log.tier,
    subPoints:
      (log.subPoints as Record<string, ActivityLogState> | null) ?? undefined,
  };
}

export function deriveHistoryTaskState(log: HistoryLogRow): ActivityLogState {
  return computeActivityXp(
    mapHistoryActivityToScored(log.activity),
    mapHistoryLogToInput(log),
    { applyGrace: false },
  ).state;
}

export function isHistoryTaskCompleted(log: HistoryLogRow): boolean {
  return deriveHistoryTaskState(log) === 'DONE';
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
        select: {
          id: true,
          seedKey: true,
          title: true,
          emoji: true,
          kind: true,
          scored: true,
          isPersonal: true,
          deductMultiplier: true,
          xpComplete: true,
          xpMiss: true,
          unitLabel: true,
          xpPerUnit: true,
          xpCap: true,
          missXp: true,
          subPoints: true,
          tiers: true,
        },
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
      tier: log.tier,
      value: log.value,
      subPoints: log.subPoints,
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
    const completed = isHistoryTaskCompleted(log);
    entries.push({
      type: 'task',
      id: log.id,
      date: log.date,
      dayNumber: log.dayNumber,
      activityId: log.activity.id,
      title: log.activity.title,
      emoji: log.activity.emoji,
      seedKey: log.activity.seedKey,
      completedAt: completed ? log.date : null,
      proofUrl: log.proofUrl,
      aiVerdict: log.aiVerdict,
      isValid: completed && isPassingAiVerdict(log.aiVerdict),
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
