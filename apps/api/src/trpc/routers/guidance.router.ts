import { z } from 'zod';
import { protectedProcedure, router } from '../trpc';

export const GUIDANCE_QUESTION_MAX_LENGTH = 1_000;
export const GUIDANCE_HISTORY_MAX_ITEMS = 12;
export const GUIDANCE_HISTORY_CONTENT_MAX_LENGTH = 2_000;

const guidanceHistorySchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().max(GUIDANCE_HISTORY_CONTENT_MAX_LENGTH),
});

export const guidanceRouter = router({
  ask: protectedProcedure
    .input(
      z.object({
        activityId: z.string().min(1),
        question: z.string().trim().min(1).max(GUIDANCE_QUESTION_MAX_LENGTH),
        history: z
          .array(guidanceHistorySchema)
          .max(GUIDANCE_HISTORY_MAX_ITEMS)
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.guidanceService.ask(ctx.prisma, ctx.user.id, input);
    }),
});
