import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import type { User } from '../generated/prisma/client';
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

  // Одноразовое использование токена: удаление и есть проверка. DELETE ... WHERE
  // token_hash = $1 атомарен, поэтому из двух параллельных refresh с одной cookie
  // выигрывает ровно один, а второй получает P2025 и честный 401. Пара
  // findUnique + delete оставляла бы окно, в котором обе вкладки выпустят по сессии.
  async consume(
    rawToken: string,
  ): Promise<{ user: PublicUser; userId: string }> {
    const record = await this.prisma.refreshToken
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

  async revokeAll(userId: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
  }

  private hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }
}
