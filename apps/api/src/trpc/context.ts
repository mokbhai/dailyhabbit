import type { CreateFastifyContextOptions } from '@trpc/server/adapters/fastify';
import type { PrismaService } from '../prisma/prisma.service';
import type { AuthService } from '../services/auth.service';
import type { ActivitiesService } from '../services/activities.service';

export type AuthUser = {
  id: string;
  email: string;
  name: string;
};

export function createContextFactory(deps: {
  prisma: PrismaService;
  authService: AuthService;
  activitiesService: ActivitiesService;
}) {
  return async function createContext({
    req,
    res,
  }: CreateFastifyContextOptions) {
    const user = await getUserFromRequest(req, deps);

    return {
      req,
      res,
      user,
      prisma: deps.prisma,
      authService: deps.authService,
      activitiesService: deps.activitiesService,
    };
  };
}

export type Context = Awaited<
  ReturnType<ReturnType<typeof createContextFactory>>
>;

async function getUserFromRequest(
  req: CreateFastifyContextOptions['req'],
  deps: { prisma: PrismaService; authService: AuthService },
): Promise<AuthUser | null> {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return null;

  const payload = deps.authService.verifyToken(token);
  if (!payload) return null;

  const user = await deps.prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, email: true, name: true },
  });

  if (!user || user.email !== payload.email) return null;

  return user;
}
