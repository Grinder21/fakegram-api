import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import { Prisma, User } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { isNotFoundError } from '../common/prisma-errors';

@Injectable()
export class RefreshTokenService {
  private readonly logger = new Logger(RefreshTokenService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async issue(
    userId: string,
    tx: Prisma.TransactionClient = this.prisma,
    familyId?: string,
  ): Promise<{ refreshToken: string; refreshTokenExpiresAt: Date }> {
    const rawToken = randomBytes(40).toString('hex');

    const days = Number(
      this.config.get<string>('REFRESH_TOKEN_TTL_DAYS', '30'),
    );
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    await tx.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hashToken(rawToken),
        expiresAt,
        familyId,
      },
    });

    return { refreshToken: rawToken, refreshTokenExpiresAt: expiresAt };
  }

  async consume(
    rawToken: string,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<{
    user: Omit<User, 'passwordHash'>;
    userId: string;
    familyId: string;
  }> {
    const tokenHash = this.hashToken(rawToken);

    const record = await tx.refreshToken
      .update({
        where: { tokenHash, used: false, expiresAt: { gt: new Date() } },
        data: { used: true },
        include: { user: { omit: { passwordHash: true } } },
      })
      .catch(async (error: unknown) => {
        if (isNotFoundError(error)) {
          await this.revokeFamilyOfRejectedToken(tokenHash);
          throw new UnauthorizedException('Refresh token expired or not found');
        }
        throw error;
      });

    return {
      user: record.user,
      userId: record.userId,
      familyId: record.familyId,
    };
  }

  async revokeAll(userId: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
  }

  private async revokeFamilyOfRejectedToken(tokenHash: string): Promise<void> {
    try {
      const record = await this.prisma.refreshToken.findUnique({
        where: { tokenHash },
        select: { userId: true, familyId: true, used: true, expiresAt: true },
      });

      if (!record) {
        return;
      }

      const expired = record.expiresAt <= new Date();
      if (!record.used && !expired) {
        return;
      }

      if (record.used) {
        this.logger.warn(
          `Refresh token reuse detected (user ${record.userId}, family ${record.familyId}). Revoking the whole family.`,
        );
      }

      await this.prisma.refreshToken.deleteMany({
        where: { familyId: record.familyId },
      });
    } catch (error: unknown) {
      this.logger.error(
        'Failed to revoke refresh token family',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }
}
