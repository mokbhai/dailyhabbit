import { Injectable } from '@nestjs/common';
import {
  ActivitiesService,
  type GetTodayResult,
  type TodayActivity,
} from '../services/activities.service';
import { getLeaderboard } from '../services/leaderboard.service';
import {
  computeDayScore,
  type ScoredActivity,
} from '../services/scoring.service';
import { getDashboardStats } from '../services/stats.service';
import { isActivityLogLogged } from '../utils/day-completion';
import type { PrismaService } from '../prisma/prisma.service';

export type ReminderContext = {
  name: string;
  dayNumber: number;
  tasksDone: number;
  tasksRemaining: number;
  todayNetXp: number;
  xpAtRisk: number;
  rank: number | null;
  totalXp: number;
};

function todayActivityToScored(activity: TodayActivity): ScoredActivity {
  return {
    id: activity.id,
    kind: activity.kind,
    scored: activity.scored,
    isPersonal: activity.isPersonal,
    deductMultiplier: activity.deductMultiplier,
    xpComplete: activity.xpComplete,
    xpMiss: activity.xpMiss,
    unitLabel: activity.unitLabel,
    xpPerUnit: activity.xpPerUnit,
    xpCap: activity.xpCap,
    missXp: activity.missXp,
    subPoints: activity.subPoints,
    tiers: activity.tiers,
  };
}

export function countTasksFromToday(scoredActivities: TodayActivity[]): {
  tasksDone: number;
  tasksRemaining: number;
} {
  let tasksDone = 0;
  let tasksRemaining = 0;

  for (const activity of scoredActivities) {
    if (!activity.scored) {
      continue;
    }
    const log = activity.log;
    if (log && isActivityLogLogged(log)) {
      tasksDone += 1;
    } else {
      tasksRemaining += 1;
    }
  }

  return { tasksDone, tasksRemaining };
}

export function computeXpAtRisk(scoredActivities: TodayActivity[]): number {
  const scored = scoredActivities.filter((a) => a.scored && !a.isPersonal);
  const activities = scored.map(todayActivityToScored);

  const logsById = Object.fromEntries(
    scored.map((a) => [
      a.id,
      a.log
        ? {
            activityId: a.id,
            state: a.log.state,
            value: a.log.value,
            tier: a.log.tier,
            subPoints: a.log.subPoints,
          }
        : undefined,
    ]),
  );

  const withGrace = computeDayScore(activities, logsById, {
    applyGrace: true,
  });
  const withoutGrace = computeDayScore(activities, logsById, {
    applyGrace: false,
  });

  return Math.max(0, withGrace.xpDeducted - withoutGrace.xpDeducted);
}

export function buildReminderContextFromToday(
  name: string,
  today: GetTodayResult,
  stats: { todayNetXp: number; totalXp: number },
  rank: number | null,
): ReminderContext {
  const { tasksDone, tasksRemaining } = countTasksFromToday(
    today.scoredActivities,
  );
  const xpAtRisk = computeXpAtRisk(today.scoredActivities);

  return {
    name,
    dayNumber: today.currentDay,
    tasksDone,
    tasksRemaining,
    todayNetXp: stats.todayNetXp,
    xpAtRisk,
    rank,
    totalXp: stats.totalXp,
  };
}

export function hasEveningReminderEligibility(
  context: ReminderContext,
): boolean {
  return context.tasksRemaining > 0 || context.xpAtRisk > 0;
}

@Injectable()
export class ReminderContextService {
  constructor(private readonly activitiesService: ActivitiesService) {}

  async buildContext(
    prisma: PrismaService,
    userId: string,
    userName: string,
  ): Promise<ReminderContext> {
    const stats = await getDashboardStats(prisma, userId);

    let rank: number | null = null;
    try {
      const leaderboard = await getLeaderboard(prisma, userId);
      rank = leaderboard.members.find((m) => m.id === userId)?.rank ?? null;
    } catch {
      // User has no group — rank remains null
    }

    const today = await this.activitiesService.getToday(prisma, userId);

    return buildReminderContextFromToday(userName, today, stats, rank);
  }
}

export function buildReminderContextFromFixture(input: {
  name: string;
  today: GetTodayResult;
  todayNetXp: number;
  totalXp: number;
  rank?: number | null;
}): ReminderContext {
  return buildReminderContextFromToday(
    input.name,
    input.today,
    { todayNetXp: input.todayNetXp, totalXp: input.totalXp },
    input.rank ?? null,
  );
}
