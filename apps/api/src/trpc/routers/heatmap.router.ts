import { z } from 'zod';
import { getHeatmap, setDayLabel } from '../../services/heatmap.service';
import { DEFAULT_CHALLENGE_LENGTH_DAYS } from '../../utils/challenge-query';
import { protectedProcedure, router } from '../trpc';

export const heatmapRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    return getHeatmap(ctx.prisma, ctx.user.id);
  }),

  setDayLabel: protectedProcedure
    .input(
      z.object({
        dayNumber: z.number().int().min(1).max(DEFAULT_CHALLENGE_LENGTH_DAYS),
        labelText: z.string().min(1).max(200),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return setDayLabel(
        ctx.prisma,
        ctx.user.id,
        input.dayNumber,
        input.labelText,
      );
    }),
});
