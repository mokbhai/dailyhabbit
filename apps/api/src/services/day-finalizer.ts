import { computeDayLoggingStatus } from '../utils/day-completion';
import {
  currentDayFromDates,
  fallbackScheduledEnd,
  lengthDaysFromRange,
} from '../utils/challenge-range';
import {
  type ActivityLogInput,
  type DayScoreBreakdownEntry,
  type ScoredActivity,
  computeDayScore,
} from './scoring.service';

export type EvaluateDayRolloverInput = {
  challenge: {
    startDate?: Date;
    endDate?: Date | null;
    currentDay: number;
    lengthDays: number;
    currentStreak: number;
    longestStreak: number;
  };
  previousDay?: Date;
  timezone?: string;
  scoredActivities: ScoredActivity[];
  personalActivities?: ScoredActivity[];
  previousDayLogs: ActivityLogInput[];
};

export type EvaluateDayRolloverResult = {
  dayScore: {
    dayNumber: number;
    xpEarned: number;
    xpDeducted: number;
    netXp: number;
    personalXp: number;
    breakdown: {
      allScoredLogged: boolean;
      entries: DayScoreBreakdownEntry[];
    };
  };
  challengeUpdate: {
    currentDay: number;
    currentStreak: number;
    longestStreak: number;
    totalXpIncrement: number;
    completed: boolean;
  };
};

export function evaluateDayRollover(
  input: EvaluateDayRolloverInput,
): EvaluateDayRolloverResult {
  const {
    challenge,
    scoredActivities,
    personalActivities = [],
    previousDayLogs,
  } = input;

  const scoredActivityIds = scoredActivities.map((activity) => activity.id);
  const { allScoredLogged } = computeDayLoggingStatus(
    scoredActivityIds,
    previousDayLogs.map((log) => ({
      activityId: log.activityId,
      state: log.state ?? null,
      tier: log.tier ?? null,
      value: log.value ?? null,
      subPoints: log.subPoints ?? null,
    })),
  );

  const personalActivityIds = personalActivities.map((activity) => activity.id);
  const { allScoredLogged: allPersonalLogged } = computeDayLoggingStatus(
    personalActivityIds,
    previousDayLogs.map((log) => ({
      activityId: log.activityId,
      state: log.state ?? null,
      tier: log.tier ?? null,
      value: log.value ?? null,
      subPoints: log.subPoints ?? null,
    })),
  );

  const logsById = Object.fromEntries(
    previousDayLogs.map((log) => [log.activityId, log]),
  );

  const allActivities = [...scoredActivities, ...personalActivities];
  const score = computeDayScore(allActivities, logsById, { applyGrace: true });

  // Streak gating: scored activities when present, otherwise personal-only days
  // require all personal activities logged (avoids vacuous true when scored set is empty).
  const dayCounted =
    scoredActivities.length > 0
      ? allScoredLogged
      : personalActivities.length > 0
        ? allPersonalLogged
        : false;
  const newStreak = dayCounted ? challenge.currentStreak + 1 : 0;
  const newLongestStreak = Math.max(challenge.longestStreak, newStreak);
  const timezone = input.timezone ?? 'UTC';
  const endDate =
    challenge.startDate && challenge.endDate !== undefined
      ? fallbackScheduledEnd(
          {
            startDate: challenge.startDate,
            endDate: challenge.endDate,
            lengthDays: challenge.lengthDays,
          },
          timezone,
        )
      : null;
  const lengthDays =
    challenge.startDate && endDate
      ? lengthDaysFromRange(challenge.startDate, endDate, timezone)
      : challenge.lengthDays;
  const dayNumber =
    challenge.startDate && endDate && input.previousDay
      ? currentDayFromDates(
          challenge.startDate,
          endDate,
          timezone,
          input.previousDay,
        )
      : challenge.currentDay;
  const completed = dayNumber >= lengthDays;
  const newDay = completed ? lengthDays + 1 : dayNumber + 1;

  return {
    dayScore: {
      dayNumber,
      xpEarned: score.xpEarned,
      xpDeducted: score.xpDeducted,
      netXp: score.netXp,
      personalXp: score.personalXp,
      breakdown: {
        // Means "all gating activities logged for this day" (scored for grouped
        // users, personal for personal-only) so completion metadata matches streak.
        allScoredLogged: dayCounted,
        entries: score.breakdown,
      },
    },
    challengeUpdate: {
      currentDay: newDay,
      currentStreak: newStreak,
      longestStreak: newLongestStreak,
      totalXpIncrement: score.netXp,
      completed,
    },
  };
}
