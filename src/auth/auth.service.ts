import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RefreshTokenService } from './refresh-token.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { isUniqueConstraintError } from '../common/prisma-errors';
import { Prisma } from '../generated/prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private refreshTokens: RefreshTokenService,
  ) {}

  async register(dto: RegisterDto) {
    const passwordHash = await bcrypt.hash(dto.password, 10);

    return await this.prisma.$transaction(async (tx) => {
      const user = await tx.user
        .create({
          data: {
            email: dto.email,
            username: dto.username,
            passwordHash,
            displayName: dto.displayName,
          },
          omit: { passwordHash: true },
        })
        .catch((error: unknown) => {
          if (isUniqueConstraintError(error)) {
            throw new ConflictException('Email or username already taken');
          }
          throw error;
        });

      const tokens = await this.issueSession(user.id, user.username, tx);
      return { user, ...tokens };
    });
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const { passwordHash: _, ...userWithoutHash } = user;
    const tokens = await this.issueSession(user.id, user.username);
    return { user: userWithoutHash, ...tokens };
  }

  async refresh(cookieToken: string) {
    const { user, userId } = await this.refreshTokens.consume(cookieToken);
    const tokens = await this.issueSession(userId, user.username);
    return { user, ...tokens };
  }

  async logout(userId: string) {
    await this.refreshTokens.revokeAll(userId);
  }

  async getMe(userId: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      omit: { passwordHash: true },
    });
  }

  private async issueSession(
    userId: string,
    username: string,
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    const accessToken = this.jwt.sign({ sub: userId, username });
    const refresh = await this.refreshTokens.issue(userId, tx);
    return {
      accessToken,
      refreshToken: refresh.refreshToken,
      refreshTokenExpiresAt: refresh.refreshTokenExpiresAt,
    };
  }
}
