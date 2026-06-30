import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { CreateFastifyContextOptions } from '@trpc/server/adapters/fastify';

type FastifyRequest = CreateFastifyContextOptions['req'];

export type JwtPayload = {
  userId: string;
  /** Present on tokens issued before phone-auth migration; ignored for validation. */
  email?: string | null;
};

const DEFAULT_JWT_SECRET = 'change-me';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly jwtSecret: string;

  constructor(private readonly config: ConfigService) {
    const configuredSecret =
      this.config.get<string>('JWT_SECRET')?.trim() || undefined;
    const isProduction = process.env.NODE_ENV === 'production';

    // Default/missing secrets are publicly known; production must use a strong JWT_SECRET or tokens are forgeable.
    if (
      isProduction &&
      (!configuredSecret || configuredSecret === DEFAULT_JWT_SECRET)
    ) {
      throw new Error(
        'JWT_SECRET must be set to a strong secret in production. Set the JWT_SECRET environment variable before starting the API.',
      );
    }

    this.jwtSecret = configuredSecret ?? DEFAULT_JWT_SECRET;

    if (!isProduction && !configuredSecret) {
      this.logger.warn(
        'JWT_SECRET is unset or empty; using the default development secret. Do not use this in production.',
      );
    }
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  signToken(payload: Pick<JwtPayload, 'userId'>): string {
    return jwt.sign(payload, this.jwtSecret, { expiresIn: '7d' });
  }

  verifyToken(token: string): JwtPayload | null {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as JwtPayload;
      if (!decoded.userId) return null;
      return { userId: decoded.userId, email: decoded.email ?? null };
    } catch {
      return null;
    }
  }

  detectTimezone(req: FastifyRequest): string {
    const header = req.headers['x-timezone'];
    if (typeof header === 'string' && header.length > 0) {
      try {
        Intl.DateTimeFormat(undefined, { timeZone: header });
        return header;
      } catch {
        // invalid timezone
      }
    }
    return 'UTC';
  }
}
