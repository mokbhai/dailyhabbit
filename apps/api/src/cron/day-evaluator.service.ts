import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import {
  mapActivityToScored,
  mapLogToInput,
} from '../services/activities.service';
import { evaluateDayRollover } from '../services/day-finalizer';
import { activeChallengeRelationArgs } from '../utils/challenge-query';
import { fallbackScheduledEnd } from '../utils/challenge-range';
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
        group: { select: { challengeTimezone: true } },
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
          user.group?.challengeTimezone ?? user.timezone,
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
    challengeTimezone: string,
    groupId: string | null,
    challenge: {
      id: string;
      startDate: Date;
      endDate: Date | null;
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

    const localToday = getUserLocalDate(challengeTimezone);
    const previousDay = addLocalDays(localToday, -1, challengeTimezone);
    const challengeStartDay = getUserLocalDate(
      challengeTimezone,
      challenge.startDate,
    );
    const challengeEndDay = getUserLocalDate(
      challengeTimezone,
      fallbackScheduledEnd(challenge, challengeTimezone),
    );

    if (previousDay.getTime() < challengeStartDay.getTime()) {
      return;
    }

    const evaluationDay =
      previousDay.getTime() > challengeEndDay.getTime()
        ? challengeEndDay
        : previousDay;

    const existingScore = await this.prisma.dayScore.findFirst({
      where: {
        challengeId: challenge.id,
        date: evaluationDay,
      },
    });

    if (existingScore?.finalized) {
      if (previousDay.getTime() > challengeEndDay.getTime()) {
        await this.prisma.challenge.update({
          where: { id: challenge.id },
          data: { isActive: false },
        });
      }
      return;
    }

    const activityLogs = await this.prisma.activityLog.findMany({
      where: {
        challengeId: challenge.id,
        userId,
        date: evaluationDay,
      },
    });

    const result = evaluateDayRollover({
      challenge: {
        currentDay: challenge.currentDay,
        lengthDays: challenge.lengthDays,
        startDate: challenge.startDate,
        endDate: challenge.endDate,
        currentStreak: challenge.currentStreak,
        longestStreak: challenge.longestStreak,
      },
      previousDay: evaluationDay,
      timezone: challengeTimezone,
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
            date: evaluationDay,
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
            date: evaluationDay,
          },
        },
        create: {
          challengeId: challenge.id,
          userId,
          date: evaluationDay,
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
          ...(result.challengeUpdate.completed ? { isActive: false } : {}),
        },
      });
    });
  }
}
