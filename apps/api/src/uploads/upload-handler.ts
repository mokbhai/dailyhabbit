import { randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { access } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import type { Readable } from 'node:stream';
import path from 'node:path';
import type { PrismaService } from '../prisma/prisma.service';
import type { AuthService } from '../services/auth.service';

type UploadRequest = {
  headers: { authorization?: string };
  file: () => Promise<{ filename: string; file: Readable } | undefined>;
};

type UploadReply = {
  status: (code: number) => { send: (body: unknown) => unknown };
};

type UploadFileRequest = {
  headers: { authorization?: string };
  params: { filename?: string };
};

type UploadFileReply = {
  status: (code: number) => { send: (body: unknown) => unknown };
  header: (name: string, value: string) => UploadFileReply;
  send: (body: unknown) => unknown;
};

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const UPLOAD_FILENAME_PATTERN = /^[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp)$/i;
const CONTENT_TYPES = new Map([
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp'],
]);

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

export function createUploadHandler(deps: {
  uploadDir: string;
  authService: Pick<AuthService, 'verifyToken'>;
  prisma: Pick<PrismaService, 'user'>;
}) {
  const { uploadDir, authService, prisma } = deps;

  return async (request: UploadRequest, reply: UploadReply) => {
    const auth = await authenticateUpload(request.headers.authorization, {
      authService,
      prisma,
    });
    if (!auth) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const data = await request.file();

    if (!data) {
      return reply.status(400).send({ error: 'No file uploaded' });
    }

    let ext: string;
    try {
      ext = sanitizeUploadExtension(data.filename);
    } catch {
      return reply.status(400).send({ error: 'Unsupported file type' });
    }

    const filename = `${randomUUID()}${ext}`;
    const filepath = path.join(uploadDir, filename);

    await pipeline(data.file, createWriteStream(filepath));

    return { url: `/uploads/${filename}` };
  };
}

export function resolveUploadFilePath(
  uploadDir: string,
  filename: string | undefined,
): string | null {
  if (!filename || !UPLOAD_FILENAME_PATTERN.test(filename)) {
    return null;
  }

  const uploadRoot = path.resolve(uploadDir);
  const filePath = path.resolve(uploadRoot, filename);
  if (filePath !== path.join(uploadRoot, path.basename(filePath))) {
    return null;
  }

  return filePath;
}

export function createUploadFileHandler(deps: {
  uploadDir: string;
  authService: Pick<AuthService, 'verifyToken'>;
  prisma: Pick<PrismaService, 'user'>;
}) {
  const { uploadDir, authService, prisma } = deps;

  return async (request: UploadFileRequest, reply: UploadFileReply) => {
    const auth = await authenticateUpload(request.headers.authorization, {
      authService,
      prisma,
    });
    if (!auth) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const filePath = resolveUploadFilePath(uploadDir, request.params.filename);
    if (!filePath) {
      return reply.status(404).send({ error: 'Not found' });
    }

    try {
      await access(filePath);
    } catch {
      return reply.status(404).send({ error: 'Not found' });
    }

    const contentType =
      CONTENT_TYPES.get(path.extname(filePath).toLowerCase()) ??
      'application/octet-stream';
    return reply
      .header('Content-Type', contentType)
      .header('Cache-Control', 'private, max-age=300')
      .send(createReadStream(filePath));
  };
}
