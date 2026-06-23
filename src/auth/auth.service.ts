import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.email }, { username: dto.username }] },
    });
    if (existing) {
      throw new ConflictException('Email or username already taken');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        username: dto.username,
        passwordHash,
        displayName: dto.displayName,
      },
      omit: { passwordHash: true },
    });

    const tokens = await this.generateTokens(user.id, user.username);
    return { user, ...tokens };
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
    const tokens = await this.generateTokens(user.id, user.username);
    return { user: userWithoutHash, ...tokens };
  }

  async refresh(cookieToken: string) {
    const [recordId, rawToken] = cookieToken.split(':');

    if (!recordId || !rawToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const record = await this.prisma.refreshToken.findUnique({
      where: { id: recordId },
      include: { user: { omit: { passwordHash: true } } },
    });

    if (!record || record.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired or not found');
    }

    const tokenValid = await bcrypt.compare(rawToken, record.tokenHash);
    if (!tokenValid) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.prisma.refreshToken.delete({ where: { id: recordId } });

    const tokens = await this.generateTokens(
      record.userId,
      record.user.username,
    );
    return { user: record.user, ...tokens };
  }

  async logout(cookieToken: string) {
    const [recordId] = cookieToken.split(':');
    if (recordId) {
      await this.prisma.refreshToken.deleteMany({ where: { id: recordId } });
    }
  }

  async getMe(userId: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      omit: { passwordHash: true },
    });
  }

  private async generateTokens(userId: string, username: string) {
    const accessToken = this.jwt.sign({ sub: userId, username });

    const rawToken = randomBytes(40).toString('hex');
    const tokenHash = await bcrypt.hash(rawToken, 10);

    const days = this.config.get<number>('REFRESH_TOKEN_TTL_DAYS', 30);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);

    const { id: recordId } = await this.prisma.refreshToken.create({
      data: { userId, tokenHash, expiresAt },
    });

    return {
      accessToken,
      refreshToken: `${recordId}:${rawToken}`,
      refreshTokenExpiresAt: expiresAt,
    };
  }
}
