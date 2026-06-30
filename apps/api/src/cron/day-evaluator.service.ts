import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import {
  mapActivityToScored,
  mapLogToInput,
} from '../services/activities.service';
import { computeDayScore } from '../services/scoring.service';
import { activeChallengeRelationArgs } from '../utils/challenge-query';
import { computeDayLoggingStatus } from '../utils/day-completion';
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

    const scoredActivityIds = scoredActivities.map((activity) => activity.id);
    const { allScoredLogged } = computeDayLoggingStatus(
      scoredActivityIds,
      activityLogs.map((log) => ({
        activityId: log.activityId,
        state: log.state,
        tier: log.tier,
        value: log.value,
        subPoints: log.subPoints,
      })),
    );

    const logsById = Object.fromEntries(
      activityLogs.map((log) => [log.activityId, mapLogToInput(log)]),
    );

    const score = computeDayScore(
      activities.map(mapActivityToScored),
      logsById,
      { applyGrace: true },
    );

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
          dayNumber: challenge.currentDay,
          netXp: score.netXp,
          xpEarned: score.xpEarned,
          xpDeducted: score.xpDeducted,
          personalXp: score.personalXp,
          breakdown: { allScoredLogged, entries: score.breakdown },
          finalized: true,
        },
        update: {
          netXp: score.netXp,
          xpEarned: score.xpEarned,
          xpDeducted: score.xpDeducted,
          personalXp: score.personalXp,
          breakdown: { allScoredLogged, entries: score.breakdown },
          finalized: true,
        },
      });

      const newStreak = allScoredLogged ? challenge.currentStreak + 1 : 0;
      const newLongestStreak = Math.max(challenge.longestStreak, newStreak);
      const newDay = challenge.currentDay + 1;
      const completed = newDay > challenge.lengthDays;

      await tx.challenge.update({
        where: { id: challenge.id },
        data: {
          currentDay: completed ? challenge.lengthDays + 1 : newDay,
          currentStreak: newStreak,
          longestStreak: newLongestStreak,
          totalXp: { increment: score.netXp },
          ...(completed ? { isActive: false, endDate: new Date() } : {}),
        },
      });
    });
  }
}
