import { z } from 'zod';
import { protectedProcedure, router } from '../trpc';

const activityLogStateSchema = z.enum(['DONE', 'FAILED', 'UNLOGGED']);

export const activitiesRouter = router({
  getToday: protectedProcedure.query(async ({ ctx }) => {
    return ctx.activitiesService.getToday(ctx.prisma, ctx.user.id);
  }),

  markActivity: protectedProcedure
    .input(z.object({ activityId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      return ctx.activitiesService.markActivity(
        ctx.prisma,
        ctx.user.id,
        input.activityId,
      );
    }),

  logNumber: protectedProcedure
    .input(
      z.object({
        activityId: z.string().min(1),
        value: z.number().finite().min(0),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.activitiesService.logNumber(
        ctx.prisma,
        ctx.user.id,
        input.activityId,
        input.value,
      );
    }),

  setSubPoints: protectedProcedure
    .input(
      z.object({
        activityId: z.string().min(1),
        states: z.record(z.string(), activityLogStateSchema),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.activitiesService.setSubPoints(
        ctx.prisma,
        ctx.user.id,
        input.activityId,
        input.states,
      );
    }),

  setTier: protectedProcedure
    .input(
      z.object({
        activityId: z.string().min(1),
        tier: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.activitiesService.setTier(
        ctx.prisma,
        ctx.user.id,
        input.activityId,
        input.tier,
      );
    }),

  undoActivity: protectedProcedure
    .input(z.object({ activityId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      return ctx.activitiesService.undoActivity(
        ctx.prisma,
        ctx.user.id,
        input.activityId,
      );
    }),

  attachProof: protectedProcedure
    .input(
      z.object({
        activityId: z.string().min(1),
        proofUrl: z.string().url(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.activitiesService.attachProof(
        ctx.prisma,
        ctx.user.id,
        input.activityId,
        input.proofUrl,
      );
    }),
});
