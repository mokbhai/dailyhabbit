import { TRPCError } from '@trpc/server';
import type { PrismaService } from '../prisma/prisma.service';
import { challengeDisplayOrderBy } from '../utils/challenge-query';
import { isInterimDayCompleted } from '../utils/day-completion';
import { addLocalDays, getUserLocalDate } from '../utils/day-window';
import { getLiveStreak } from '../utils/live-streak';

export type DashboardStats = {
  totalXp: number;
  todayNetXp: number;
  currentDay: number;
  startDate: Date | null;
  todayDate: Date;
  estimatedFinishDate: Date | null;
  currentStreak: number;
  longestStreak: number;
  totalDaysCompleted: number;
  successRate: number;
  timesRestarted: number;
};

export async function getDashboardStats(
  prisma: PrismaService,
  userId: string,
): Promise<DashboardStats> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
  }

  const todayDate = getUserLocalDate(user.timezone);

  const challenge = await prisma.challenge.findFirst({
    where: { userId },
    orderBy: challengeDisplayOrderBy,
  });

  const allDayScores = await prisma.dayScore.findMany({
    where: { challenge: { userId } },
    select: { finalized: true, breakdown: true },
  });

  const finalizedScores = allDayScores.filter((day) => day.finalized);
  const totalDaysCompleted = finalizedScores.filter((day) =>
    isInterimDayCompleted(day),
  ).length;
  const totalDaysEvaluated = finalizedScores.length;
  const successRate =
    totalDaysEvaluated > 0
      ? Math.round((totalDaysCompleted / totalDaysEvaluated) * 100)
      : 0;

  let todayNetXp = 0;
  if (challenge) {
    const todayScore = await prisma.dayScore.findFirst({
      where: { challengeId: challenge.id, date: todayDate },
      select: { netXp: true, finalized: true },
    });
    todayNetXp = todayScore?.netXp ?? 0;
  }

  const totalXp = (challenge?.totalXp ?? 0) + todayNetXp;

  const currentStreak = challenge
    ? await getLiveStreak(prisma, {
        challengeId: challenge.id,
        userId,
        groupId: user.groupId,
        timezone: user.timezone,
        storedStreak: challenge.currentStreak,
      })
    : 0;

  const lengthDays = challenge?.lengthDays ?? 30;
  const daysRemaining = challenge
    ? Math.max(0, lengthDays - (challenge.currentDay - 1))
    : lengthDays;
  const estimatedFinishDate =
    challenge && daysRemaining > 0
      ? addLocalDays(todayDate, daysRemaining, user.timezone)
      : challenge && challenge.currentDay > lengthDays
        ? todayDate
        : null;

  return {
    totalXp,
    todayNetXp,
    currentDay: challenge?.currentDay ?? 1,
    startDate: challenge?.startDate ?? null,
    todayDate,
    estimatedFinishDate,
    currentStreak,
    longestStreak: challenge
      ? Math.max(challenge.longestStreak, currentStreak)
      : 0,
    totalDaysCompleted,
    successRate,
    timesRestarted: 0,
  };
}
