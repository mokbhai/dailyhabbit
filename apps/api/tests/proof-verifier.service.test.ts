import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveUploadFilePath } from '../src/services/proof-verifier.service';

const uploadDir = path.resolve('/var/app/data/uploads');

describe('resolveUploadFilePath', () => {
  it('resolves /uploads/abc.jpg inside uploadDir', () => {
    expect(resolveUploadFilePath(uploadDir, '/uploads/abc.jpg')).toBe(
      path.join(uploadDir, 'abc.jpg'),
    );
  });

  it('resolves bare abc.jpg inside uploadDir', () => {
    expect(resolveUploadFilePath(uploadDir, 'abc.jpg')).toBe(
      path.join(uploadDir, 'abc.jpg'),
    );
  });

  it('throws for path traversal via /uploads/../../../etc/passwd', () => {
    expect(() =>
      resolveUploadFilePath(uploadDir, '/uploads/../../../etc/passwd'),
    ).toThrow(/escapes upload directory/);
  });

  it('throws for http URLs', () => {
    expect(() =>
      resolveUploadFilePath(uploadDir, 'http://evil.example/x.jpg'),
    ).toThrow(/not allowed/);
  });

  it('throws for data URIs', () => {
    expect(() =>
      resolveUploadFilePath(uploadDir, 'data:image/png;base64,xx'),
    ).toThrow(/not allowed/);
  });

  it('throws when resolved path lands in a sibling directory (prefix collision)', () => {
    const siblingUploadDir = path.resolve('/tmp/uploads');
    expect(() =>
      resolveUploadFilePath(siblingUploadDir, '../uploads-evil/secret.jpg'),
    ).toThrow(/escapes upload directory/);
  });
});
