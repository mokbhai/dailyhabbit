import { TRPCError } from '@trpc/server';
import type { PrismaService } from '../prisma/prisma.service';
import { latestChallengeRelationArgs } from '../utils/challenge-query';
import {
  DEFAULT_CHALLENGE_WINDOW_DAYS,
  deriveChallengeProgress,
} from '../utils/challenge-range';
import {
  isInterimDayCompleted,
  isInterimDayFailed,
} from '../utils/day-completion';
import { isGroupAdmin } from '../utils/group-admin';

export type HeatmapCellState =
  | 'completed'
  | 'failed'
  | 'future'
  | 'today'
  | 'not_started';

export type HeatmapCell = {
  dayNumber: number;
  state: HeatmapCellState;
  dayLabel: string | null;
};

function dayScoreCompleted(score: {
  finalized: boolean;
  breakdown: unknown;
}): boolean {
  return isInterimDayCompleted(score);
}

export async function getHeatmap(
  prisma: PrismaService,
  userId: string,
): Promise<{ cells: HeatmapCell[]; isGroupAdmin: boolean }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      group: {
        include: { dayLabels: true },
      },
      challenges: {
        ...latestChallengeRelationArgs(),
        include: { dayScores: true },
      },
    },
  });

  if (!user) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
  }

  const challenge = user.challenges[0] ?? null;
  const labelMap = new Map(
    (user.group?.dayLabels ?? []).map((label) => [
      label.dayNumber,
      label.labelText,
    ]),
  );

  const scoresByDay = new Map(
    (challenge?.dayScores ?? []).map((score) => [score.dayNumber, score]),
  );

  const timezone = user.group?.challengeTimezone ?? user.timezone;
  const progress = challenge
    ? deriveChallengeProgress(challenge, timezone)
    : null;
  const currentDay = progress?.currentDay ?? 0;
  const isActive = challenge?.isActive ?? false;
  const lengthDays = progress?.lengthDays ?? DEFAULT_CHALLENGE_WINDOW_DAYS;

  const cells: HeatmapCell[] = [];

  for (let dayNumber = 1; dayNumber <= lengthDays; dayNumber++) {
    let state: HeatmapCellState;

    if (!challenge) {
      state = 'not_started';
    } else if (currentDay > lengthDays) {
      const score = scoresByDay.get(dayNumber);
      if (score && dayScoreCompleted(score)) state = 'completed';
      else if (score && isInterimDayFailed(score)) state = 'failed';
      else state = 'not_started';
    } else if (dayNumber === currentDay && isActive) {
      state = 'today';
    } else if (dayNumber > currentDay) {
      state = 'future';
    } else {
      const score = scoresByDay.get(dayNumber);
      if (score && dayScoreCompleted(score)) state = 'completed';
      else if (score && isInterimDayFailed(score)) state = 'failed';
      else state = 'not_started';
    }

    cells.push({
      dayNumber,
      state,
      dayLabel: labelMap.get(dayNumber) ?? null,
    });
  }

  const isAdmin = user.group
    ? await isGroupAdmin(prisma, user.group.id, userId, user.group.adminUserId)
    : false;

  return { cells, isGroupAdmin: isAdmin };
}

export async function setDayLabel(
  prisma: PrismaService,
  userId: string,
  dayNumber: number,
  labelText: string,
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user?.groupId) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'No group found' });
  }

  const group = await prisma.group.findUnique({ where: { id: user.groupId } });

  if (!group) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Group not found' });
  }

  if (!(await isGroupAdmin(prisma, group.id, userId, group.adminUserId))) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin only' });
  }

  const challenge = await prisma.challenge.findFirst({
    where: { userId },
    orderBy: [{ isActive: 'desc' }, { startDate: 'desc' }],
    select: {
      startDate: true,
      endDate: true,
      lengthDays: true,
      currentDay: true,
    },
  });
  const maxDay = challenge
    ? deriveChallengeProgress(
        challenge,
        group.challengeTimezone ?? user.timezone,
      ).lengthDays
    : DEFAULT_CHALLENGE_WINDOW_DAYS;

  if (dayNumber < 1 || dayNumber > maxDay) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Day must be 1–${maxDay}`,
    });
  }

  const label = await prisma.dayLabel.upsert({
    where: {
      groupId_dayNumber: {
        groupId: user.groupId,
        dayNumber,
      },
    },
    create: {
      groupId: user.groupId,
      dayNumber,
      labelText,
      setByUserId: userId,
    },
    update: {
      labelText,
      setByUserId: userId,
    },
  });

  return label;
}
