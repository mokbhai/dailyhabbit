import { afterEach, describe, expect, it, vi } from 'vitest';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../src/services/auth.service';

const originalNodeEnv = process.env.NODE_ENV;

function createConfig(jwtSecret?: string): ConfigService {
  return {
    get: (key: string) => {
      if (key === 'JWT_SECRET') return jwtSecret;
      return undefined;
    },
  } as unknown as ConfigService;
}

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
  vi.restoreAllMocks();
});

describe('AuthService JWT_SECRET validation', () => {
  it('throws in production when JWT_SECRET is missing', () => {
    process.env.NODE_ENV = 'production';

    expect(() => new AuthService(createConfig())).toThrow(
      /JWT_SECRET must be set to a strong secret in production/,
    );
  });

  it('throws in production when JWT_SECRET is change-me', () => {
    process.env.NODE_ENV = 'production';

    expect(() => new AuthService(createConfig('change-me'))).toThrow(
      /JWT_SECRET must be set to a strong secret in production/,
    );
  });

  it('throws in production when JWT_SECRET is empty or whitespace-only', () => {
    process.env.NODE_ENV = 'production';

    expect(() => new AuthService(createConfig(''))).toThrow(
      /JWT_SECRET must be set to a strong secret in production/,
    );
    expect(() => new AuthService(createConfig('   '))).toThrow(
      /JWT_SECRET must be set to a strong secret in production/,
    );
  });

  it('constructs without throwing when NODE_ENV is unset (test/dev bootstrap)', () => {
    delete process.env.NODE_ENV;

    const service = new AuthService(createConfig());
    const token = service.signToken({ userId: 'user-1' });
    expect(service.verifyToken(token)).toEqual({
      userId: 'user-1',
      email: null,
    });
  });

  it('constructs in production with a real secret and round-trips tokens', () => {
    process.env.NODE_ENV = 'production';
    const service = new AuthService(
      createConfig('super-secret-key-for-tests-only'),
    );

    const token = service.signToken({ userId: 'user-1' });
    expect(service.verifyToken(token)).toEqual({
      userId: 'user-1',
      email: null,
    });
  });

  it('uses fallback in development and logs a warning', () => {
    process.env.NODE_ENV = 'development';
    const warnSpy = vi.spyOn(Logger.prototype, 'warn');

    const service = new AuthService(createConfig());
    const token = service.signToken({ userId: 'user-1' });

    expect(service.verifyToken(token)).toEqual({
      userId: 'user-1',
      email: null,
    });
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0]?.[0]).toMatch(
      /JWT_SECRET is unset.*Do not use this in production/,
    );
  });
});
