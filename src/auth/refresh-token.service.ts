import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import type { Prisma, User } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { isNotFoundError } from '../common/prisma-errors';

// Один и тот же текст на «не найден» и «просрочен»: клиенту в обоих случаях
// нужно заново логиниться, а различать эти ситуации снаружи незачем.
const INVALID_TOKEN = 'Refresh token expired or not found';

type PublicUser = Omit<User, 'passwordHash'>;

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

    const days = Number(
      this.config.get<string>('REFRESH_TOKEN_TTL_DAYS', '30'),
    );
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);

    await tx.refreshToken.create({
      data: { userId, tokenHash: this.hashToken(rawToken), expiresAt },
    });

    return { refreshToken: rawToken, refreshTokenExpiresAt: expiresAt };
  }

  // Одноразовое использование токена: удаление и есть проверка. DELETE ... WHERE
  // token_hash = $1 атомарен, поэтому из двух параллельных refresh с одной cookie
  // выигрывает ровно один, а второй получает P2025 и честный 401. Пара
  // findUnique + delete оставляла бы окно, в котором обе вкладки выпустят по сессии.
  async consume(
    rawToken: string,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<{ user: PublicUser; userId: string }> {
    const record = await tx.refreshToken
      .delete({
        where: { tokenHash: this.hashToken(rawToken) },
        include: { user: { omit: { passwordHash: true } } },
      })
      .catch((error: unknown) => {
        if (isNotFoundError(error)) {
          throw new UnauthorizedException(INVALID_TOKEN);
        }
        throw error;
      });

    if (record.expiresAt < new Date()) {
      throw new UnauthorizedException(INVALID_TOKEN);
    }

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
