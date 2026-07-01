import { TRPCError } from '@trpc/server';
import type { PrismaService } from '../prisma/prisma.service';

export type GroupWithPrimaryAdmin = {
  id: string;
  adminUserId: string;
};

export async function getGroupAdminUserIds(
  prisma: PrismaService,
  groupId: string,
  legacyAdminUserId?: string | null,
): Promise<string[]> {
  const memberships = await prisma.groupAdmin.findMany({
    where: { groupId },
    select: { userId: true },
    orderBy: { createdAt: 'asc' },
  });
  const adminIds = memberships.map((membership) => membership.userId);

  // Transitional fallback for databases created before the GroupAdmin
  // backfill runs. Once migrated, membership rows are the source of truth.
  if (adminIds.length === 0 && legacyAdminUserId) {
    return [legacyAdminUserId];
  }

  return adminIds;
}

export async function isGroupAdmin(
  prisma: PrismaService,
  groupId: string,
  userId: string,
  legacyAdminUserId?: string | null,
): Promise<boolean> {
  const adminIds = await getGroupAdminUserIds(
    prisma,
    groupId,
    legacyAdminUserId,
  );
  return adminIds.includes(userId);
}

export async function requireGroupAdmin(
  prisma: PrismaService,
  userId: string,
  groupId: string,
): Promise<GroupWithPrimaryAdmin> {
  const group = await prisma.group.findUnique({ where: { id: groupId } });

  if (!group) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Group not found' });
  }

  if (!(await isGroupAdmin(prisma, group.id, userId, group.adminUserId))) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin only' });
  }

  return group;
}

export async function getReplacementAdminId(
  prisma: PrismaService,
  groupId: string,
  excludingUserId: string,
): Promise<string | null> {
  const replacement = await prisma.groupAdmin.findFirst({
    where: {
      groupId,
      userId: { not: excludingUserId },
    },
    select: { userId: true },
    orderBy: { createdAt: 'asc' },
  });

  return replacement?.userId ?? null;
}
