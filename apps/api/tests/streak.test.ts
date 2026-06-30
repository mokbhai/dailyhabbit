import { AiVerdict, TaskType } from '@workspace-starter/db';
import { describe, expect, it } from 'vitest';
import {
  ALL_TASK_TYPES,
  computeCurrentStreak,
} from '../src/services/tasks.service';

function makeValidLog(taskType: TaskType) {
  return {
    taskType,
    isValid: true,
    aiVerdict: AiVerdict.PASSED,
    completedAt: new Date(),
  };
}

describe('computeCurrentStreak', () => {
  it('returns 0 on day 1 before all tasks are complete', () => {
    expect(computeCurrentStreak(1, [])).toBe(0);
    expect(
      computeCurrentStreak(1, [makeValidLog(TaskType.DIET)]),
    ).toBe(0);
  });

  it('returns 1 on day 1 once all tasks are complete', () => {
    const logs = ALL_TASK_TYPES.map((taskType) => makeValidLog(taskType));

    expect(computeCurrentStreak(1, logs)).toBe(1);
  });

  it('returns previous-day streak when today is incomplete', () => {
    const logs = ALL_TASK_TYPES.map((taskType) => makeValidLog(taskType));

    expect(computeCurrentStreak(3, logs.slice(0, 5))).toBe(2);
  });

  it('includes today when all tasks are complete', () => {
    const logs = ALL_TASK_TYPES.map((taskType) => makeValidLog(taskType));

    expect(computeCurrentStreak(3, logs)).toBe(3);
  });
});
