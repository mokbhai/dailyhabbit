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
    if (!groupId) {
      return;
    }

    const activities = await this.prisma.activity.findMany({
      where: {
        OR: [
          { groupId, active: true, scored: true },
          { ownerUserId: userId, isPersonal: true, active: true },
        ],
      },
    });

    const scoredActivities = activities.filter(
      (a) => a.scored && !a.isPersonal,
    );

    if (scoredActivities.length === 0) {
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

    const personalActivities = activities.filter((a) => a.isPersonal);

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
