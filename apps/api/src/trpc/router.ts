import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from './trpc';

const usersRouter = router({
  list: publicProcedure.query(async () => {
    // TODO: replace with real DB call
    return [{ id: '1', name: 'Mokshit Jain', email: 'm@example.com' }];
  }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      // TODO: replace with real DB call
      return { id: input.id, name: 'Mokshit Jain', email: 'm@example.com' };
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        email: z.string().email(),
      }),
    )
    .mutation(async ({ input }) => {
      // TODO: replace with real DB call
      return { id: crypto.randomUUID(), ...input };
    }),
});

export const appRouter = router({
  users: usersRouter,
});

// This type is imported by apps/web for end-to-end type safety
export type AppRouter = typeof appRouter;
