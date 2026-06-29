import type { CreateFastifyContextOptions } from '@trpc/server/adapters/fastify';

// Extend this with db, redis, user, etc. as the app grows
export async function createContext({ req, res }: CreateFastifyContextOptions) {
  // TODO: extract user from JWT / session
  const user = getUserFromRequest(req);

  return {
    req,
    res,
    user,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;

// Placeholder — replace with real JWT verification
function getUserFromRequest(req: CreateFastifyContextOptions['req']) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;
  // e.g. return verifyJwt(token);
  return null;
}
