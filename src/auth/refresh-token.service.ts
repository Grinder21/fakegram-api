import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import { User } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { isNotFoundError } from '../common/prisma-errors';

@Injectable()
export class RefreshTokenService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async issue(
    userId: string,
  ): Promise<{ refreshToken: string; refreshTokenExpiresAt: Date }> {
    const rawToken = randomBytes(40).toString('hex');

    const days = Number(
      this.config.get<string>('REFRESH_TOKEN_TTL_DAYS', '30'),
    );
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);

    await this.prisma.refreshToken.create({
      data: { userId, tokenHash: this.hashToken(rawToken), expiresAt },
    });

    return { refreshToken: rawToken, refreshTokenExpiresAt: expiresAt };
  }

  async consume(
    rawToken: string,
  ): Promise<{ user: Omit<User, 'passwordHash'>; userId: string }> {
    const record = await this.prisma.refreshToken
      .delete({
        where: { tokenHash: this.hashToken(rawToken) },
        include: { user: { omit: { passwordHash: true } } },
      })
      .catch((error: unknown) => {
        if (isNotFoundError(error)) {
          throw new UnauthorizedException('Refresh token expired or not found');
        }
        throw error;
      });

    if (record.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired or not found');
    }

    return { user: record.user, userId: record.userId };
  }

  async revokeAll(userId: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
  }

  private hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }
}
