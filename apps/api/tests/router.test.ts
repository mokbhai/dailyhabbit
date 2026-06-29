import { describe, expect, it } from 'vitest';
import { appRouter } from '../src/trpc/router';
import type { Context } from '../src/trpc/context';

function createTestContext(): Context {
  return {
    req: {} as Context['req'],
    res: {} as Context['res'],
    user: null,
  };
}

describe('appRouter users procedures', () => {
  it('lists the starter sample user', async () => {
    const caller = appRouter.createCaller(createTestContext());

    await expect(caller.users.list()).resolves.toEqual([
      { id: '1', name: 'Mokshit Jain', email: 'm@example.com' },
    ]);
  });

  it('returns a user by id', async () => {
    const caller = appRouter.createCaller(createTestContext());

    await expect(caller.users.getById({ id: '42' })).resolves.toEqual({
      id: '42',
      name: 'Mokshit Jain',
      email: 'm@example.com',
    });
  });

  it('rejects unauthenticated user creation', async () => {
    const caller = appRouter.createCaller(createTestContext());

    await expect(
      caller.users.create({ name: 'Ada Lovelace', email: 'ada@example.com' }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });
});
