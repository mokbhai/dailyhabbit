import { describe, expect, it } from 'vitest';
import { BUILTIN_ACTIVITIES } from '@workspace-starter/db';
import {
  type ActivityLogInput,
  type ScoredActivity,
  computeActivityXp,
  computeDayScore,
} from '../src/services/scoring.service';

function toScoredActivity(
  seed: (typeof BUILTIN_ACTIVITIES)[number],
  id: string,
): ScoredActivity {
  return {
    id,
    kind: seed.kind,
    scored: seed.scored,
    isPersonal: seed.isPersonal,
    deductMultiplier: seed.deductMultiplier,
    xpComplete: seed.xpComplete,
    xpMiss: seed.xpMiss,
    unitLabel: seed.unitLabel,
    xpPerUnit: seed.xpPerUnit,
    xpCap: seed.xpCap,
    missXp: seed.missXp,
    subPoints: seed.subPoints as ScoredActivity['subPoints'],
    tiers: seed.tiers as ScoredActivity['tiers'],
  };
}

const checkboxActivity: ScoredActivity = {
  id: 'progress-photo',
  kind: 'CHECKBOX',
  scored: true,
  isPersonal: false,
  deductMultiplier: 2,
  xpComplete: 200,
  xpMiss: -200,
};

const waterActivity: ScoredActivity = {
  id: 'water',
  kind: 'NUMBER',
  scored: true,
  isPersonal: false,
  deductMultiplier: 2,
  unitLabel: 'L',
  xpPerUnit: 26.3,
  xpCap: 100,
  missXp: -100,
};

const tieredActivity: ScoredActivity = {
  id: 'no-reels',
  kind: 'TIERED',
  scored: true,
  isPersonal: false,
  deductMultiplier: 2,
  tiers: [
    { key: 'NONE', label: '0 min', maxMinutes: 0, xp: 250 },
    { key: 'UNDER_30', label: '<=30 min', maxMinutes: 30, xp: 150 },
    { key: 'UNDER_60', label: '<=60 min', maxMinutes: 60, xp: 60 },
    { key: 'OVER', label: '>60 min', maxMinutes: null, xp: 0 },
  ],
};

const dietActivity: ScoredActivity = {
  id: 'diet',
  kind: 'SUBPOINTS',
  scored: true,
  isPersonal: false,
  deductMultiplier: 3,
  subPoints: [
    { key: 'HEALTHY', label: 'Healthy', xp: 60 },
    { key: 'NO_JUNK', label: 'No junk', xp: 70 },
    { key: 'NO_ALCOHOL', label: 'No alcohol', xp: 20 },
  ],
};

describe('computeActivityXp — CHECKBOX', () => {
  it.each([
    {
      label: 'done',
      log: { activityId: 'progress-photo', state: 'DONE' as const },
      applyGrace: false,
      expected: { earned: 200, deducted: 0, state: 'DONE' },
    },
    {
      label: 'failed',
      log: { activityId: 'progress-photo', state: 'FAILED' as const },
      applyGrace: false,
      expected: { earned: 0, deducted: 200, state: 'FAILED' },
    },
    {
      label: 'unlogged with grace',
      log: undefined,
      applyGrace: true,
      expected: { earned: 0, deducted: 100, state: 'UNLOGGED' },
    },
    {
      label: 'unlogged without grace',
      log: undefined,
      applyGrace: false,
      expected: { earned: 0, deducted: 0, state: 'UNLOGGED' },
    },
  ])('$label', ({ log, applyGrace, expected }) => {
    expect(computeActivityXp(checkboxActivity, log, { applyGrace })).toEqual(
      expected,
    );
  });
});

describe('computeActivityXp — NUMBER', () => {
  it.each([
    {
      label: 'per-unit below cap',
      log: { activityId: 'water', value: 2 },
      applyGrace: false,
      expected: { earned: 53, deducted: 0, state: 'DONE' },
    },
    {
      label: 'cap boundary 3.8 L',
      log: { activityId: 'water', value: 3.8 },
      applyGrace: false,
      expected: { earned: 100, deducted: 0, state: 'DONE' },
    },
    {
      label: 'value 0',
      log: { activityId: 'water', value: 0 },
      applyGrace: false,
      expected: { earned: 0, deducted: 100, state: 'FAILED' },
    },
    {
      label: 'explicit failed state',
      log: { activityId: 'water', state: 'FAILED' as const },
      applyGrace: false,
      expected: { earned: 0, deducted: 100, state: 'FAILED' },
    },
    {
      label: 'unlogged with grace',
      log: undefined,
      applyGrace: true,
      expected: { earned: 0, deducted: 50, state: 'UNLOGGED' },
    },
    {
      label: 'unlogged without grace',
      log: undefined,
      applyGrace: false,
      expected: { earned: 0, deducted: 0, state: 'UNLOGGED' },
    },
  ])('$label', ({ log, applyGrace, expected }) => {
    expect(computeActivityXp(waterActivity, log, { applyGrace })).toEqual(
      expected,
    );
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid value %s',
    (value) => {
      expect(() =>
        computeActivityXp(
          waterActivity,
          { activityId: 'water', value },
          { applyGrace: false },
        ),
      ).toThrow(/Invalid NUMBER activity value/);
    },
  );
});

describe('computeActivityXp — TIERED', () => {
  it.each([
    { tier: 'NONE', earned: 250 },
    { tier: 'UNDER_30', earned: 150 },
    { tier: 'UNDER_60', earned: 60 },
    { tier: 'OVER', earned: 0 },
  ])('tier $tier awards $earned XP', ({ tier, earned }) => {
    expect(
      computeActivityXp(
        tieredActivity,
        { activityId: 'no-reels', tier },
        { applyGrace: true },
      ),
    ).toEqual({ earned, deducted: 0, state: 'DONE' });
  });

  it.each([
    { label: 'no log', log: undefined },
    { label: 'unknown tier', log: { activityId: 'no-reels', tier: 'UNKNOWN' } },
  ])('never penalizes when $label', ({ log }) => {
    expect(
      computeActivityXp(tieredActivity, log, { applyGrace: true }),
    ).toEqual({ earned: 0, deducted: 0, state: 'UNLOGGED' });
  });
});

describe('computeActivityXp — SUBPOINTS', () => {
  it('awards full credit when all sub-points are done', () => {
    expect(
      computeActivityXp(
        dietActivity,
        {
          activityId: 'diet',
          subPoints: {
            HEALTHY: 'DONE',
            NO_JUNK: 'DONE',
            NO_ALCOHOL: 'DONE',
          },
        },
        { applyGrace: false },
      ),
    ).toEqual({ earned: 150, deducted: 0, state: 'DONE' });
  });

  it('applies partial credit and failed multiplier without grace', () => {
    expect(
      computeActivityXp(
        dietActivity,
        {
          activityId: 'diet',
          subPoints: {
            HEALTHY: 'DONE',
            NO_JUNK: 'FAILED',
          },
        },
        { applyGrace: false },
      ),
    ).toEqual({ earned: 60, deducted: 210, state: 'FAILED' });
  });

  it('applies grace half-rate on unlogged sub-points', () => {
    expect(
      computeActivityXp(
        dietActivity,
        {
          activityId: 'diet',
          subPoints: {
            HEALTHY: 'DONE',
            NO_JUNK: 'FAILED',
          },
        },
        { applyGrace: true },
      ),
    ).toEqual({ earned: 60, deducted: 240, state: 'FAILED' });
  });
});

describe('computeDayScore', () => {
  const builtinActivities = BUILTIN_ACTIVITIES.map((seed, index) =>
    toScoredActivity(seed, `builtin-${index + 1}`),
  );

  function allDoneLogs(): Record<string, ActivityLogInput> {
    const logs: Record<string, ActivityLogInput> = {};
    for (const activity of builtinActivities) {
      if (activity.kind === 'CHECKBOX') {
        logs[activity.id] = { activityId: activity.id, state: 'DONE' };
        continue;
      }
      if (activity.kind === 'NUMBER') {
        logs[activity.id] = { activityId: activity.id, value: 3.8 };
        continue;
      }
      if (activity.kind === 'TIERED') {
        logs[activity.id] = { activityId: activity.id, tier: 'NONE' };
        continue;
      }
      logs[activity.id] = {
        activityId: activity.id,
        subPoints: Object.fromEntries(
          (activity.subPoints ?? []).map((subPoint) => [
            subPoint.key,
            'DONE' as const,
          ]),
        ),
      };
    }
    return logs;
  }

  it('matches the spec max positive day of 1350 XP', () => {
    const result = computeDayScore(builtinActivities, allDoneLogs(), {
      applyGrace: false,
    });
    expect(result.xpEarned).toBe(1350);
    expect(result.xpDeducted).toBe(0);
    expect(result.netXp).toBe(1350);
    expect(result.personalXp).toBe(0);
  });

  it('max positive day is unchanged when grace is enabled', () => {
    const result = computeDayScore(builtinActivities, allDoneLogs(), {
      applyGrace: true,
    });
    expect(result.netXp).toBe(1350);
  });

  it('allows a negative net day', () => {
    const logs: Record<string, ActivityLogInput> = {
      [checkboxActivity.id]: {
        activityId: checkboxActivity.id,
        state: 'FAILED',
      },
      [waterActivity.id]: { activityId: waterActivity.id, value: 0 },
      [tieredActivity.id]: { activityId: tieredActivity.id, tier: 'OVER' },
      [dietActivity.id]: {
        activityId: dietActivity.id,
        subPoints: {
          HEALTHY: 'FAILED',
          NO_JUNK: 'FAILED',
          NO_ALCOHOL: 'FAILED',
        },
      },
    };

    const activities = [
      checkboxActivity,
      waterActivity,
      tieredActivity,
      dietActivity,
    ];
    const result = computeDayScore(activities, logs, { applyGrace: false });

    expect(result.xpEarned).toBe(0);
    expect(result.xpDeducted).toBe(750);
    expect(result.netXp).toBe(-750);
  });

  it('keeps personal activities out of netXp but in personalXp', () => {
    const personalCheckbox: ScoredActivity = {
      ...checkboxActivity,
      id: 'personal-journal',
      scored: false,
      isPersonal: true,
    };
    const scoredCheckbox: ScoredActivity = {
      ...checkboxActivity,
      id: 'scored-photo',
      scored: true,
      isPersonal: false,
    };

    const logs: Record<string, ActivityLogInput> = {
      [personalCheckbox.id]: {
        activityId: personalCheckbox.id,
        state: 'DONE',
      },
      [scoredCheckbox.id]: {
        activityId: scoredCheckbox.id,
        state: 'DONE',
      },
    };

    const result = computeDayScore([scoredCheckbox, personalCheckbox], logs, {
      applyGrace: false,
    });

    expect(result.netXp).toBe(200);
    expect(result.personalXp).toBe(200);
    expect(result.xpEarned).toBe(200);
    expect(result.breakdown).toHaveLength(2);
  });

  it('excludes non-scored non-personal activities from totals', () => {
    const unscored: ScoredActivity = {
      ...checkboxActivity,
      id: 'unscored',
      scored: false,
      isPersonal: false,
    };

    const result = computeDayScore(
      [unscored],
      { [unscored.id]: { activityId: unscored.id, state: 'DONE' } },
      { applyGrace: false },
    );

    expect(result.netXp).toBe(0);
    expect(result.personalXp).toBe(0);
    expect(result.xpEarned).toBe(0);
  });
});
