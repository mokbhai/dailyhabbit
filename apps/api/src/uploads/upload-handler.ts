import path from 'node:path';
import type { PrismaService } from '../prisma/prisma.service';
import type { AuthService } from '../services/auth.service';

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

export async function authenticateUpload(
  authHeader: string | undefined,
  deps: {
    authService: Pick<AuthService, 'verifyToken'>;
    prisma: Pick<PrismaService, 'user'>;
  },
): Promise<{ userId: string } | null> {
  const token = authHeader?.replace(/^Bearer\s+/i, '');
  if (!token) return null;

  const payload = deps.authService.verifyToken(token);
  if (!payload) return null;

  const user = await deps.prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true },
  });

  if (!user) return null;

  return { userId: user.id };
}

/** Reject unknown extensions so uploads cannot be stored as executable or unexpected types. */
export function sanitizeUploadExtension(originalFilename: string): string {
  const rawExt = path.extname(originalFilename).toLowerCase();
  const cleaned = rawExt.replace(/[^a-z0-9.]/g, '');

  if (!ALLOWED_EXTENSIONS.has(cleaned)) {
    throw new Error(`Unsupported file extension: ${rawExt || '(none)'}`);
  }

  return cleaned;
}
