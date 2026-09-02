import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RefreshTokenService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  // Параметр tx со значением по умолчанию — задел под prisma.$transaction:
  // вызовы пока передают дефолт (this.prisma), но точка расширения уже есть.
  async issue(
    userId: string,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<{ refreshToken: string; refreshTokenExpiresAt: Date }> {
    const rawToken = randomBytes(40).toString('hex');

    const days = Number(this.config.get<number>('REFRESH_TOKEN_TTL_DAYS', 30));
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);

    await tx.refreshToken.create({
      data: { userId, tokenHash: this.hashToken(rawToken), expiresAt },
    });

    return { refreshToken: rawToken, refreshTokenExpiresAt: expiresAt };
  }

  // Находит запись по хешу, проверяет срок, удаляет её (ротация) и
  // возвращает вместе с user без passwordHash.
  async consume(rawToken: string, tx: Prisma.TransactionClient = this.prisma) {
    const record = await tx.refreshToken.findUnique({
      where: { tokenHash: this.hashToken(rawToken) },
      include: { user: { omit: { passwordHash: true } } },
    });

    if (!record || record.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired or not found');
    }

    await tx.refreshToken.delete({ where: { id: record.id } });

    return { user: record.user, userId: record.userId };
  }

  async revokeAll(
    userId: string,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await tx.refreshToken.deleteMany({ where: { userId } });
  }

  private hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }
}
