import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TRPCError } from '@trpc/server';
import {
  ActivityKind,
  PrismaClient,
  seedGroupActivities,
} from '@workspace-starter/db';
import { ActivitiesService } from '../src/services/activities.service';
import {
  buildMarkActivityPayload,
  mapActivityToScored,
  mapLogToInput,
  recomputeLiveDayScore,
} from '../src/services/activities.service';
import { ProofVerifierService } from '../src/services/proof-verifier.service';
import { getLeaderboard } from '../src/services/leaderboard.service';
import { getDashboardStats } from '../src/services/stats.service';
import { getUserLocalDate } from '../src/utils/day-window';
import type { PrismaService } from '../src/prisma/prisma.service';

const TEST_EMAIL = `activities-test-${Date.now()}@example.com`;

describe('activities helpers', () => {
  it('buildMarkActivityPayload fills SUBPOINTS with DONE', () => {
    const activity = {
      id: 'a1',
      kind: 'SUBPOINTS' as const,
      scored: true,
      isPersonal: false,
      deductMultiplier: 3,
      subPoints: [
        { key: 'A', label: 'A', xp: 10 },
        { key: 'B', label: 'B', xp: 20 },
      ],
    };
    const payload = buildMarkActivityPayload(activity);
    expect(payload.subPoints).toEqual({ A: 'DONE', B: 'DONE' });
  });

  it('buildMarkActivityPayload picks best TIERED tier', () => {
    const activity = {
      id: 't1',
      kind: 'TIERED' as const,
      scored: true,
      isPersonal: false,
      deductMultiplier: 2,
      tiers: [
        { key: 'OVER', label: 'Over', maxMinutes: null, xp: 0 },
        { key: 'NONE', label: 'None', maxMinutes: 0, xp: 250 },
      ],
    };
    const payload = buildMarkActivityPayload(activity);
    expect(payload.tier).toBe('NONE');
  });
});

describe('activities integration', () => {
  let prisma: PrismaClient;
  let service: ActivitiesService;
  let userId: string;
  let groupId: string;
  let challengeId: string;
  let dietActivityId: string;
  let checkboxActivityId: string;
  let personalActivityId: string;

  beforeAll(async () => {
    prisma = new PrismaClient();
    service = new ActivitiesService({
      verifyProof: async () => ({
        passed: true,
        confidence: 1,
        reason: 'SKIPPED',
      }),
    } as unknown as ProofVerifierService);

    const admin = await prisma.user.create({
      data: {
        name: 'Activities Test Admin',
        email: `admin-${TEST_EMAIL}`,
        passwordHash: 'hash',
        timezone: 'UTC',
      },
    });

    const group = await prisma.group.create({
      data: {
        name: 'Activities Test Group',
        inviteToken: `invite-${Date.now()}`,
        adminUserId: admin.id,
      },
    });
    groupId = group.id;

    await seedGroupActivities(prisma, groupId);

    const user = await prisma.user.create({
      data: {
        name: 'Activities Test User',
        email: TEST_EMAIL,
        passwordHash: 'hash',
        timezone: 'UTC',
        groupId,
      },
    });
    userId = user.id;

    const challenge = await prisma.challenge.create({
      data: {
        userId,
        groupId,
        startDate: getUserLocalDate('UTC'),
        lengthDays: 30,
        currentDay: 1,
        isActive: true,
      },
    });
    challengeId = challenge.id;

    const activities = await prisma.activity.findMany({
      where: { groupId },
      orderBy: { sortOrder: 'asc' },
    });

    dietActivityId = activities.find((a) => a.seedKey === 'DIET')!.id;
    checkboxActivityId = activities.find(
      (a) => a.seedKey === 'PROGRESS_PHOTO',
    )!.id;

    const personal = await prisma.activity.create({
      data: {
        ownerUserId: userId,
        title: 'Personal journal',
        kind: ActivityKind.CHECKBOX,
        scored: false,
        isPersonal: true,
        xpComplete: 50,
        xpMiss: -10,
        deductMultiplier: 2,
        active: true,
      },
    });
    personalActivityId = personal.id;
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.activityLog.deleteMany({ where: { userId } });
    await prisma.dayScore.deleteMany({ where: { userId } });
    await prisma.challenge.deleteMany({ where: { userId } });
    await prisma.activity.deleteMany({ where: { ownerUserId: userId } });
    await prisma.user.update({
      where: { id: userId },
      data: { groupId: null },
    });
    await prisma.group.delete({ where: { id: groupId } }).catch(() => {});
    await prisma.user.deleteMany({
      where: { email: { in: [TEST_EMAIL, `admin-${TEST_EMAIL}`] } },
    });
    await prisma.$disconnect();
  });

  it('markActivity is idempotent for CHECKBOX', async () => {
    const first = await service.markActivity(
      prisma as unknown as PrismaService,
      userId,
      checkboxActivityId,
    );
    const second = await service.markActivity(
      prisma as unknown as PrismaService,
      userId,
      checkboxActivityId,
    );
    expect(second.log.xpAwarded).toBe(first.log.xpAwarded);
    expect(second.log.xpAwarded).toBe(200);
  });

  it('undoActivity reverts log and zeroes xp', async () => {
    await service.undoActivity(
      prisma as unknown as PrismaService,
      userId,
      checkboxActivityId,
    );
    const log = await prisma.activityLog.findFirst({
      where: { challengeId, activityId: checkboxActivityId },
    });
    expect(log?.xpAwarded).toBe(0);
    expect(log?.state).toBeNull();
  });

  it('logNumber rejects non-NUMBER activities', async () => {
    await expect(
      service.logNumber(
        prisma as unknown as PrismaService,
        userId,
        checkboxActivityId,
        2,
      ),
    ).rejects.toBeInstanceOf(TRPCError);
  });

  it('attachProof rejects DIET', async () => {
    await expect(
      service.attachProof(
        prisma as unknown as PrismaService,
        userId,
        dietActivityId,
        'https://example.com/photo.jpg',
      ),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('personal activity xp is excluded from netXp', async () => {
    await service.markActivity(
      prisma as unknown as PrismaService,
      userId,
      personalActivityId,
    );
    const today = getUserLocalDate('UTC');
    const dayScore = await prisma.dayScore.findFirst({
      where: { challengeId, date: today },
    });
    expect(dayScore?.personalXp).toBeGreaterThan(0);
    expect(dayScore?.netXp).toBe(0);
  });

  it('live DayScore uses applyGrace false (unlogged = 0 deducted)', async () => {
    await prisma.activityLog.deleteMany({ where: { challengeId } });
    await prisma.dayScore.deleteMany({ where: { challengeId } });

    const activities = await prisma.activity.findMany({
      where: {
        OR: [
          { groupId, active: true, scored: true },
          { ownerUserId: userId, isPersonal: true, active: true },
        ],
      },
    });

    const challenge = await prisma.challenge.findUniqueOrThrow({
      where: { id: challengeId },
    });

    const totals = await recomputeLiveDayScore(
      prisma as unknown as PrismaService,
      {
        challenge,
        userId,
        timezone: 'UTC',
        groupId,
      },
    );

    expect(totals.xpDeducted).toBe(0);
    expect(totals.netXp).toBe(0);

    const scored = activities
      .filter((a) => a.scored && !a.isPersonal)
      .map(mapActivityToScored);
    const logsById: Record<
      string,
      ReturnType<typeof mapLogToInput> | undefined
    > = {};
    for (const activity of scored) {
      logsById[activity.id] = undefined;
    }
    expect(scored.length).toBeGreaterThan(0);
  });

  it('stats.getDashboard returns totalXp including today', async () => {
    await service.markActivity(
      prisma as unknown as PrismaService,
      userId,
      checkboxActivityId,
    );
    const stats = await getDashboardStats(
      prisma as unknown as PrismaService,
      userId,
    );
    expect(stats.todayNetXp).toBeGreaterThan(0);
    expect(stats.totalXp).toBe(stats.todayNetXp);
  });

  it('leaderboard aggregates today window xp', async () => {
    const board = await getLeaderboard(
      prisma as unknown as PrismaService,
      userId,
      'today',
      'xp',
    );
    const self = board.members.find((m) => m.id === userId);
    expect(self?.xp).toBeGreaterThan(0);
  });
});
