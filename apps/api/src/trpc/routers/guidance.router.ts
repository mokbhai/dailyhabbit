import { z } from 'zod';
import { protectedProcedure, router } from '../trpc';

const guidanceHistorySchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
});

export const guidanceRouter = router({
  ask: protectedProcedure
    .input(
      z.object({
        activityId: z.string().min(1),
        question: z.string().min(1),
        history: z.array(guidanceHistorySchema).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.guidanceService.ask(ctx.prisma, ctx.user.id, input);
    }),
});
