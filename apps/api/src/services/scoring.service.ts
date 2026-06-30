export type ActivityKind = 'CHECKBOX' | 'NUMBER' | 'TIERED' | 'SUBPOINTS';

export type ActivityLogState = 'DONE' | 'FAILED' | 'UNLOGGED';

export type SubPointConfig = {
  key: string;
  label: string;
  xp: number;
};

export type TierConfig = {
  key: string;
  label: string;
  maxMinutes: number | null;
  xp: number;
};

export type ScoredActivity = {
  id: string;
  kind: ActivityKind;
  scored: boolean;
  isPersonal: boolean;
  deductMultiplier: number;
  xpComplete?: number;
  xpMiss?: number;
  unitLabel?: string;
  xpPerUnit?: number;
  xpCap?: number;
  missXp?: number;
  subPoints?: SubPointConfig[];
  tiers?: TierConfig[];
};

export type ActivityLogInput = {
  activityId: string;
  state?: ActivityLogState | null;
  value?: number | null;
  tier?: string | null;
  subPoints?: Record<string, ActivityLogState> | null;
};

export type ComputeActivityXpOptions = {
  applyGrace: boolean;
};

export type ActivityXpResult = {
  earned: number;
  deducted: number;
  state: ActivityLogState;
};

export type DayScoreBreakdownEntry = {
  activityId: string;
  kind: ActivityKind;
  state: ActivityLogState;
  earned: number;
  deducted: number;
};

export type DayScoreResult = {
  xpEarned: number;
  xpDeducted: number;
  netXp: number;
  personalXp: number;
  breakdown: DayScoreBreakdownEntry[];
};

const GRACE_RATE = 0.5;

function roundXp(value: number): number {
  return Math.round(value);
}

function absPenalty(magnitude: number | undefined | null): number {
  return Math.abs(magnitude ?? 0);
}

function resolveCheckboxState(
  log: ActivityLogInput | undefined,
): ActivityLogState {
  if (!log?.state) {
    return 'UNLOGGED';
  }
  return log.state;
}

function computeCheckboxXp(
  activity: ScoredActivity,
  log: ActivityLogInput | undefined,
  options: ComputeActivityXpOptions,
): ActivityXpResult {
  const state = resolveCheckboxState(log);
  const xpComplete = activity.xpComplete ?? 0;
  const missPenalty = absPenalty(activity.xpMiss);

  if (state === 'DONE') {
    return { earned: xpComplete, deducted: 0, state };
  }

  if (state === 'FAILED') {
    return { earned: 0, deducted: missPenalty, state };
  }

  const deducted = options.applyGrace ? roundXp(missPenalty * GRACE_RATE) : 0;
  return { earned: 0, deducted, state: 'UNLOGGED' };
}

function assertValidNumberValue(value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(
      `Invalid NUMBER activity value: expected a non-negative finite number, got ${String(value)}`,
    );
  }
}

function resolveNumberState(
  log: ActivityLogInput | undefined,
): ActivityLogState {
  if (!log) {
    return 'UNLOGGED';
  }

  if (log.state === 'FAILED') {
    return 'FAILED';
  }

  if (log.state === 'UNLOGGED') {
    return 'UNLOGGED';
  }

  if (log.value == null) {
    return 'UNLOGGED';
  }

  assertValidNumberValue(log.value);

  if (log.value === 0) {
    return 'FAILED';
  }

  return 'DONE';
}

function computeNumberXp(
  activity: ScoredActivity,
  log: ActivityLogInput | undefined,
  options: ComputeActivityXpOptions,
): ActivityXpResult {
  const state = resolveNumberState(log);
  const missPenalty = absPenalty(activity.missXp);
  const xpPerUnit = activity.xpPerUnit ?? 0;
  const xpCap = activity.xpCap ?? Number.POSITIVE_INFINITY;

  if (state === 'DONE' && log?.value != null) {
    const earned = roundXp(Math.min(log.value * xpPerUnit, xpCap));
    return { earned, deducted: 0, state };
  }

  if (state === 'FAILED') {
    return { earned: 0, deducted: missPenalty, state };
  }

  const deducted = options.applyGrace ? roundXp(missPenalty * GRACE_RATE) : 0;
  return { earned: 0, deducted, state: 'UNLOGGED' };
}

function computeTieredXp(
  activity: ScoredActivity,
  log: ActivityLogInput | undefined,
): ActivityXpResult {
  if (!log?.tier) {
    return { earned: 0, deducted: 0, state: 'UNLOGGED' };
  }

  const matchedTier = activity.tiers?.find((tier) => tier.key === log.tier);
  if (!matchedTier) {
    return { earned: 0, deducted: 0, state: 'UNLOGGED' };
  }

  const earned = Math.max(0, matchedTier.xp);
  return { earned, deducted: 0, state: 'DONE' };
}

function resolveSubPointState(
  log: ActivityLogInput | undefined,
  subPointKey: string,
): ActivityLogState {
  const state = log?.subPoints?.[subPointKey];
  return state ?? 'UNLOGGED';
}

function computeSubPointsOverallState(
  activity: ScoredActivity,
  log: ActivityLogInput | undefined,
): ActivityLogState {
  const subPoints = activity.subPoints ?? [];
  if (subPoints.length === 0) {
    return 'UNLOGGED';
  }

  let allDone = true;
  let anyFailed = false;
  let anyLogged = false;

  for (const subPoint of subPoints) {
    const state = resolveSubPointState(log, subPoint.key);
    if (state === 'FAILED') {
      anyFailed = true;
      anyLogged = true;
      allDone = false;
      continue;
    }
    if (state === 'DONE') {
      anyLogged = true;
      continue;
    }
    allDone = false;
  }

  if (anyFailed) {
    return 'FAILED';
  }
  if (allDone && anyLogged) {
    return 'DONE';
  }
  return 'UNLOGGED';
}

function computeSubPointsXp(
  activity: ScoredActivity,
  log: ActivityLogInput | undefined,
  options: ComputeActivityXpOptions,
): ActivityXpResult {
  const subPoints = activity.subPoints ?? [];
  const multiplier = activity.deductMultiplier;
  let earnedRaw = 0;
  let deductedRaw = 0;

  for (const subPoint of subPoints) {
    const state = resolveSubPointState(log, subPoint.key);

    if (state === 'DONE') {
      earnedRaw += subPoint.xp;
      continue;
    }

    if (state === 'FAILED') {
      deductedRaw += subPoint.xp * multiplier;
      continue;
    }

    if (options.applyGrace) {
      deductedRaw += subPoint.xp * multiplier * GRACE_RATE;
    }
  }

  return {
    earned: roundXp(earnedRaw),
    deducted: roundXp(deductedRaw),
    state: computeSubPointsOverallState(activity, log),
  };
}

export function computeActivityXp(
  activity: ScoredActivity,
  log: ActivityLogInput | undefined,
  options: ComputeActivityXpOptions,
): ActivityXpResult {
  switch (activity.kind) {
    case 'CHECKBOX': {
      const result = computeCheckboxXp(activity, log, options);
      return {
        earned: roundXp(result.earned),
        deducted: roundXp(result.deducted),
        state: result.state,
      };
    }
    case 'NUMBER': {
      const result = computeNumberXp(activity, log, options);
      return {
        earned: roundXp(result.earned),
        deducted: roundXp(result.deducted),
        state: result.state,
      };
    }
    case 'TIERED': {
      const result = computeTieredXp(activity, log);
      return {
        earned: roundXp(result.earned),
        deducted: roundXp(result.deducted),
        state: result.state,
      };
    }
    case 'SUBPOINTS':
      return computeSubPointsXp(activity, log, options);
    default: {
      const _exhaustive: never = activity.kind;
      throw new Error(`Unsupported activity kind: ${String(_exhaustive)}`);
    }
  }
}

export function computeDayScore(
  activities: ScoredActivity[],
  logsByActivityId: Record<string, ActivityLogInput | undefined>,
  options: ComputeActivityXpOptions,
): DayScoreResult {
  const breakdown: DayScoreBreakdownEntry[] = [];
  let xpEarned = 0;
  let xpDeducted = 0;
  let personalXp = 0;

  for (const activity of activities) {
    const log = logsByActivityId[activity.id];
    const { earned, deducted, state } = computeActivityXp(
      activity,
      log,
      options,
    );

    breakdown.push({
      activityId: activity.id,
      kind: activity.kind,
      state,
      earned,
      deducted,
    });

    const net = earned - deducted;

    if (activity.isPersonal) {
      personalXp += net;
      continue;
    }

    if (activity.scored) {
      xpEarned += earned;
      xpDeducted += deducted;
    }
  }

  return {
    xpEarned,
    xpDeducted,
    netXp: xpEarned - xpDeducted,
    personalXp,
    breakdown,
  };
}
