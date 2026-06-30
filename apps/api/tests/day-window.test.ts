import { describe, expect, it } from 'vitest';
import { isLocalTimeMatch } from '../src/utils/day-window';

describe('isLocalTimeMatch', () => {
  it('matches when local hour:minute equals target in UTC', () => {
    const now = new Date('2026-06-15T08:00:00.000Z');
    expect(isLocalTimeMatch('UTC', '08:00', now)).toBe(true);
    expect(isLocalTimeMatch('UTC', '08:01', now)).toBe(false);
    expect(isLocalTimeMatch('UTC', '07:00', now)).toBe(false);
  });

  it('matches America/New_York local time', () => {
    // 2026-06-15 08:00 EDT = 12:00 UTC (EDT is UTC-4)
    const now = new Date('2026-06-15T12:00:00.000Z');
    expect(isLocalTimeMatch('America/New_York', '08:00', now)).toBe(true);
    expect(isLocalTimeMatch('America/New_York', '21:00', now)).toBe(false);
  });

  it('matches Asia/Kolkata local time', () => {
    // 2026-06-15 21:00 IST = 15:30 UTC (IST is UTC+5:30)
    const now = new Date('2026-06-15T15:30:00.000Z');
    expect(isLocalTimeMatch('Asia/Kolkata', '21:00', now)).toBe(true);
    expect(isLocalTimeMatch('Asia/Kolkata', '08:00', now)).toBe(false);
  });

  it('matches Europe/London during BST', () => {
    // 2026-06-15 08:00 BST = 07:00 UTC
    const now = new Date('2026-06-15T07:00:00.000Z');
    expect(isLocalTimeMatch('Europe/London', '08:00', now)).toBe(true);
  });

  it('returns false for invalid targetHHMM', () => {
    const now = new Date('2026-06-15T08:00:00.000Z');
    expect(isLocalTimeMatch('UTC', 'invalid', now)).toBe(false);
    expect(isLocalTimeMatch('UTC', '25:00', now)).toBe(false);
    expect(isLocalTimeMatch('UTC', '08:60', now)).toBe(false);
  });
});
