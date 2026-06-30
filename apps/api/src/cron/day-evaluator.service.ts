import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import {
  mapActivityToScored,
  mapLogToInput,
} from '../services/activities.service';
import { evaluateDayRollover } from '../services/day-finalizer';
import { activeChallengeRelationArgs } from '../utils/challenge-query';
import { addLocalDays, getUserLocalDate } from '../utils/day-window';

@Injectable()
export class DayEvaluatorService {
  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async evaluateDays() {
    const users = await this.prisma.user.findMany({
      where: {
        challenges: { some: { isActive: true } },
      },
      include: {
        challenges: activeChallengeRelationArgs(),
      },
    });

    for (const user of users) {
      const challenge = user.challenges[0];
      if (!challenge) continue;

      try {
        await this.evaluateUserDay(
          user.id,
          user.timezone,
          user.groupId,
          challenge,
        );
      } catch (error) {
        console.error(`Day evaluation failed for user ${user.id}:`, error);
      }
    }
  }

  private async evaluateUserDay(
    userId: string,
    timezone: string,
    groupId: string | null,
    challenge: {
      id: string;
      startDate: Date;
      currentDay: number;
      lengthDays: number;
      longestStreak: number;
      currentStreak: number;
    },
  ) {
    const orConditions: Array<Record<string, unknown>> = [
      { ownerUserId: userId, isPersonal: true, active: true },
    ];
    // Mirror loadUserActivities: only match group/scored activities when the user has a group.
    if (groupId) {
      orConditions.unshift({ groupId, active: true, scored: true });
    }

    const activities = await this.prisma.activity.findMany({
      where: { OR: orConditions },
    });

    const scoredActivities = activities.filter(
      (a) => a.scored && !a.isPersonal,
    );
    const personalActivities = activities.filter((a) => a.isPersonal);

    if (scoredActivities.length === 0 && personalActivities.length === 0) {
      return;
    }

    const localToday = getUserLocalDate(timezone);
    const previousDay = addLocalDays(localToday, -1, timezone);
    const challengeStartDay = getUserLocalDate(timezone, challenge.startDate);

    if (previousDay.getTime() < challengeStartDay.getTime()) {
      return;
    }

    const existingScore = await this.prisma.dayScore.findFirst({
      where: {
        challengeId: challenge.id,
        date: previousDay,
      },
    });

    if (existingScore?.finalized) {
      return;
    }

    const activityLogs = await this.prisma.activityLog.findMany({
      where: {
        challengeId: challenge.id,
        userId,
        date: previousDay,
      },
    });

    const result = evaluateDayRollover({
      challenge: {
        currentDay: challenge.currentDay,
        lengthDays: challenge.lengthDays,
        currentStreak: challenge.currentStreak,
        longestStreak: challenge.longestStreak,
      },
      scoredActivities: scoredActivities.map(mapActivityToScored),
      personalActivities: personalActivities.map(mapActivityToScored),
      previousDayLogs: activityLogs.map(mapLogToInput),
    });

    await this.prisma.$transaction(async (tx) => {
      // Authoritative guard: re-read inside the tx so concurrent finalizers cannot
      // both pass the outer check and double-increment totalXp (SQLite/libSQL
      // serializes writers; the first tx to set finalized wins).
      const current = await tx.dayScore.findUnique({
        where: {
          challengeId_date: {
            challengeId: challenge.id,
            date: previousDay,
          },
        },
        select: { finalized: true },
      });
      if (current?.finalized) {
        return;
      }

      await tx.dayScore.upsert({
        where: {
          challengeId_date: {
            challengeId: challenge.id,
            date: previousDay,
          },
        },
        create: {
          challengeId: challenge.id,
          userId,
          date: previousDay,
          dayNumber: result.dayScore.dayNumber,
          netXp: result.dayScore.netXp,
          xpEarned: result.dayScore.xpEarned,
          xpDeducted: result.dayScore.xpDeducted,
          personalXp: result.dayScore.personalXp,
          breakdown: result.dayScore.breakdown,
          finalized: true,
        },
        update: {
          netXp: result.dayScore.netXp,
          xpEarned: result.dayScore.xpEarned,
          xpDeducted: result.dayScore.xpDeducted,
          personalXp: result.dayScore.personalXp,
          breakdown: result.dayScore.breakdown,
          finalized: true,
        },
      });

      await tx.challenge.update({
        where: { id: challenge.id },
        data: {
          currentDay: result.challengeUpdate.currentDay,
          currentStreak: result.challengeUpdate.currentStreak,
          longestStreak: result.challengeUpdate.longestStreak,
          totalXp: { increment: result.challengeUpdate.totalXpIncrement },
          ...(result.challengeUpdate.completed
            ? { isActive: false, endDate: new Date() }
            : {}),
        },
      });
    });
  }
}
