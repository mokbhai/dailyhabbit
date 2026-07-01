import { describe, expect, it, vi } from 'vitest';
import {
  GUIDANCE_HISTORY_CONTENT_MAX_LENGTH,
  GUIDANCE_HISTORY_MAX_ITEMS,
  GUIDANCE_QUESTION_MAX_LENGTH,
  guidanceRouter,
} from '../src/trpc/routers/guidance.router';
import type { Context } from '../src/trpc/context';

function createContext(overrides: Partial<Context> = {}): Context {
  return {
    req: { headers: {} } as Context['req'],
    res: {} as Context['res'],
    user: null,
    prisma: {} as Context['prisma'],
    authService: {} as Context['authService'],
    activitiesService: {} as Context['activitiesService'],
    guidanceService: {
      ask: vi.fn(async () => ({ available: true, answer: 'Scoped answer.' })),
    } as Context['guidanceService'],
    ...overrides,
  };
}

describe('guidanceRouter', () => {
  it('exposes guidance.ask procedure', () => {
    expect(guidanceRouter._def.procedures).toHaveProperty('ask');
  });

  it('rejects unauthenticated guidance.ask', async () => {
    const caller = guidanceRouter.createCaller(createContext());

    await expect(
      caller.ask({
        activityId: 'activity-1',
        question: 'Does mayo count?',
      }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('returns scoped answer for authenticated users', async () => {
    const ask = vi.fn(async () => ({
      available: true,
      answer: 'Mayo salad is junk.',
    }));
    const caller = guidanceRouter.createCaller(
      createContext({
        user: {
          id: 'user-1',
          email: null,
          phone: '+919876543210',
          name: 'Sam',
        },
        guidanceService: { ask } as Context['guidanceService'],
      }),
    );

    const result = await caller.ask({
      activityId: 'activity-1',
      question: 'Does mayo count?',
    });

    expect(result).toEqual({
      available: true,
      answer: 'Mayo salad is junk.',
    });
    expect(ask).toHaveBeenCalledWith(
      expect.anything(),
      'user-1',
      expect.objectContaining({
        activityId: 'activity-1',
        question: 'Does mayo count?',
      }),
    );
  });

  it('rejects oversized questions before calling the guidance service', async () => {
    const ask = vi.fn();
    const caller = guidanceRouter.createCaller(
      createContext({
        user: {
          id: 'user-1',
          email: null,
          phone: '+919876543210',
          name: 'Sam',
        },
        guidanceService: { ask } as Context['guidanceService'],
      }),
    );

    await expect(
      caller.ask({
        activityId: 'activity-1',
        question: 'x'.repeat(GUIDANCE_QUESTION_MAX_LENGTH + 1),
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(ask).not.toHaveBeenCalled();
  });

  it('rejects oversized guidance history before calling the guidance service', async () => {
    const ask = vi.fn();
    const caller = guidanceRouter.createCaller(
      createContext({
        user: {
          id: 'user-1',
          email: null,
          phone: '+919876543210',
          name: 'Sam',
        },
        guidanceService: { ask } as Context['guidanceService'],
      }),
    );

    await expect(
      caller.ask({
        activityId: 'activity-1',
        question: 'Does this count?',
        history: Array.from({ length: GUIDANCE_HISTORY_MAX_ITEMS + 1 }, () => ({
          role: 'user' as const,
          content: 'previous question',
        })),
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(ask).not.toHaveBeenCalled();
  });

  it('rejects oversized guidance history messages before calling the guidance service', async () => {
    const ask = vi.fn();
    const caller = guidanceRouter.createCaller(
      createContext({
        user: {
          id: 'user-1',
          email: null,
          phone: '+919876543210',
          name: 'Sam',
        },
        guidanceService: { ask } as Context['guidanceService'],
      }),
    );

    await expect(
      caller.ask({
        activityId: 'activity-1',
        question: 'Does this count?',
        history: [
          {
            role: 'assistant',
            content: 'x'.repeat(GUIDANCE_HISTORY_CONTENT_MAX_LENGTH + 1),
          },
        ],
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(ask).not.toHaveBeenCalled();
  });
});
