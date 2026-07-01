import { describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  authenticateUpload,
  createUploadFileHandler,
  createUploadHandler,
  resolveUploadFilePath,
  sanitizeUploadExtension,
} from '../src/uploads/upload-handler';

const USER_ID = 'user-1';

describe('authenticateUpload', () => {
  function createDeps(
    overrides: {
      verifyToken?: ReturnType<typeof vi.fn>;
      findUnique?: ReturnType<typeof vi.fn>;
    } = {},
  ) {
    return {
      authService: {
        verifyToken:
          overrides.verifyToken ?? vi.fn(() => ({ userId: USER_ID })),
      },
      prisma: {
        user: {
          findUnique:
            overrides.findUnique ?? vi.fn(async () => ({ id: USER_ID })),
        },
      },
    };
  }

  it('returns null when authorization header is missing', async () => {
    const deps = createDeps();
    await expect(authenticateUpload(undefined, deps)).resolves.toBeNull();
    expect(deps.authService.verifyToken).not.toHaveBeenCalled();
  });

  it('returns null for malformed authorization header', async () => {
    const deps = createDeps();
    await expect(authenticateUpload('Bearer ', deps)).resolves.toBeNull();
    expect(deps.authService.verifyToken).not.toHaveBeenCalled();
  });

  it('returns null when token is invalid', async () => {
    const deps = createDeps({
      verifyToken: vi.fn(() => null),
    });
    await expect(
      authenticateUpload('Bearer bad-token', deps),
    ).resolves.toBeNull();
    expect(deps.prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('returns null when user is not found', async () => {
    const deps = createDeps({
      findUnique: vi.fn(async () => null),
    });
    await expect(
      authenticateUpload('Bearer valid-token', deps),
    ).resolves.toBeNull();
  });

  it('returns userId for valid token and existing user', async () => {
    const deps = createDeps();
    await expect(
      authenticateUpload('Bearer valid-token', deps),
    ).resolves.toEqual({ userId: USER_ID });
    expect(deps.authService.verifyToken).toHaveBeenCalledWith('valid-token');
    expect(deps.prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: USER_ID },
      select: { id: true },
    });
  });
});

describe('createUploadHandler', () => {
  it('returns 401 without parsing multipart when authorization is missing', async () => {
    const file = vi.fn();
    const request = {
      headers: {},
      file,
    };
    const send = vi.fn();
    const status = vi.fn(() => ({ send }));
    const reply = { status };

    const handler = createUploadHandler({
      uploadDir: '/tmp/uploads',
      authService: { verifyToken: () => null },
      prisma: { user: { findUnique: vi.fn() } },
    });

    await handler(request as never, reply as never);

    expect(status).toHaveBeenCalledWith(401);
    expect(send).toHaveBeenCalledWith({ error: 'Unauthorized' });
    expect(file).not.toHaveBeenCalled();
  });
});

describe('resolveUploadFilePath', () => {
  it('resolves valid upload filenames inside uploadDir', () => {
    expect(resolveUploadFilePath('/tmp/uploads', 'abc-123.jpg')).toBe(
      path.resolve('/tmp/uploads/abc-123.jpg'),
    );
  });

  it.each(['../secret.jpg', '..%2Fsecret.jpg', 'nested/file.jpg', 'file.svg'])(
    'rejects invalid filename %s',
    (filename) => {
      expect(resolveUploadFilePath('/tmp/uploads', filename)).toBeNull();
    },
  );
});

describe('createUploadFileHandler', () => {
  function createReply() {
    const send = vi.fn();
    const status = vi.fn(() => ({ send }));
    const header = vi.fn(() => ({ header, send }));
    return { reply: { status, header, send }, send, status, header };
  }

  it('returns 401 when authorization is missing', async () => {
    const { reply, status, send } = createReply();
    const handler = createUploadFileHandler({
      uploadDir: '/tmp/uploads',
      authService: { verifyToken: () => null },
      prisma: { user: { findUnique: vi.fn() } },
    });

    await handler(
      { headers: {}, params: { filename: 'abc.jpg' } },
      reply as never,
    );

    expect(status).toHaveBeenCalledWith(401);
    expect(send).toHaveBeenCalledWith({ error: 'Unauthorized' });
  });

  it('returns 404 for traversal-like filenames', async () => {
    const { reply, status, send } = createReply();
    const handler = createUploadFileHandler({
      uploadDir: '/tmp/uploads',
      authService: { verifyToken: () => ({ userId: USER_ID }) },
      prisma: { user: { findUnique: vi.fn(async () => ({ id: USER_ID })) } },
    });

    await handler(
      {
        headers: { authorization: 'Bearer token' },
        params: { filename: '../x.jpg' },
      },
      reply as never,
    );

    expect(status).toHaveBeenCalledWith(404);
    expect(send).toHaveBeenCalledWith({ error: 'Not found' });
  });

  it('streams an existing upload for an authenticated user', async () => {
    const uploadDir = await mkdtemp(path.join(tmpdir(), 'uploads-'));
    try {
      await writeFile(path.join(uploadDir, 'proof.jpg'), 'image-bytes');
      const { reply, header, send } = createReply();
      const handler = createUploadFileHandler({
        uploadDir,
        authService: { verifyToken: () => ({ userId: USER_ID }) },
        prisma: {
          user: { findUnique: vi.fn(async () => ({ id: USER_ID })) },
        },
      });

      await handler(
        {
          headers: { authorization: 'Bearer token' },
          params: { filename: 'proof.jpg' },
        },
        reply as never,
      );

      expect(header).toHaveBeenCalledWith('Content-Type', 'image/jpeg');
      expect(header).toHaveBeenCalledWith(
        'Cache-Control',
        'private, max-age=300',
      );
      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({ pipe: expect.any(Function) }),
      );
    } finally {
      await rm(uploadDir, { force: true, recursive: true });
    }
  });
});

describe('sanitizeUploadExtension', () => {
  it.each(['.jpg', '.jpeg', '.png', '.webp'])(
    'accepts %s (normalized from any case)',
    (ext) => {
      const upper = ext.toUpperCase();
      expect(sanitizeUploadExtension(`photo${upper}`)).toBe(ext);
    },
  );

  it.each(['', '.exe', '.svg', '.gif', 'noextension'])(
    'rejects unsupported extension %s',
    (ext) => {
      const filename = ext.startsWith('.') ? `file${ext}` : ext;
      expect(() => sanitizeUploadExtension(filename)).toThrow(
        /Unsupported file extension/,
      );
    },
  );

  it('does not yield path separators from malicious filenames', () => {
    const ext = sanitizeUploadExtension('../../secrets.jpg');
    expect(ext).not.toContain('/');
    expect(ext).not.toContain('\\');
    expect(ext).toBe('.jpg');
  });
});
