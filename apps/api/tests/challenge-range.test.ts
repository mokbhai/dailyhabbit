import { describe, expect, it } from 'vitest';
import {
  buildChallengeRange,
  buildCurrentIsoWeekChallengeRange,
  buildDefaultChallengeRange,
  currentDayFromDates,
  lengthDaysFromRange,
} from '../src/utils/challenge-range';

describe('challenge range helpers', () => {
  it('counts inclusive date ranges', () => {
    const start = new Date('2026-07-01T00:00:00.000Z');
    const end = new Date('2026-07-31T00:00:00.000Z');

    expect(lengthDaysFromRange(start, end, 'UTC')).toBe(31);
  });

  it('derives current day from calendar dates', () => {
    const start = new Date('2026-07-01T00:00:00.000Z');
    const end = new Date('2026-07-07T00:00:00.000Z');

    expect(
      currentDayFromDates(
        start,
        end,
        'UTC',
        new Date('2026-06-30T12:00:00.000Z'),
      ),
    ).toBe(0);
    expect(
      currentDayFromDates(
        start,
        end,
        'UTC',
        new Date('2026-07-01T12:00:00.000Z'),
      ),
    ).toBe(1);
    expect(
      currentDayFromDates(
        start,
        end,
        'UTC',
        new Date('2026-07-07T23:00:00.000Z'),
      ),
    ).toBe(7);
    expect(
      currentDayFromDates(
        start,
        end,
        'UTC',
        new Date('2026-07-08T00:01:00.000Z'),
      ),
    ).toBe(8);
  });

  it('normalizes configured ranges to local challenge days', () => {
    const range = buildChallengeRange(
      new Date('2026-06-30T18:30:00.000Z'),
      new Date('2026-07-30T18:30:00.000Z'),
      'Asia/Kolkata',
      new Date('2026-07-15T08:00:00.000Z'),
    );

    expect(range.lengthDays).toBe(31);
    expect(range.currentDay).toBe(15);
  });

  it('builds a 30-day default window without fixed-length branding', () => {
    const range = buildDefaultChallengeRange(
      'UTC',
      new Date('2026-07-01T10:00:00.000Z'),
    );

    expect(range.lengthDays).toBe(30);
    expect(range.currentDay).toBe(1);
    expect(range.endDate.toISOString()).toBe('2026-07-30T00:00:00.000Z');
  });

  it('builds ISO week ranges from Monday through Sunday', () => {
    const range = buildCurrentIsoWeekChallengeRange(
      'UTC',
      new Date('2026-07-02T12:00:00.000Z'),
    );

    expect(range.lengthDays).toBe(7);
    expect(range.startDate.toISOString()).toBe('2026-06-29T00:00:00.000Z');
    expect(range.endDate.toISOString()).toBe('2026-07-05T00:00:00.000Z');
    expect(range.currentDay).toBe(4);
  });
});
