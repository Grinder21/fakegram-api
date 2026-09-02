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

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private refreshTokens: RefreshTokenService,
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

    const tokens = await this.issueSession(user.id, user.username);
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

  // Шов между аутентификацией и хранением сессии: подпись JWT — задача
  // AuthService, выпуск refresh-токена делегирован RefreshTokenService.
  private async issueSession(userId: string, username: string) {
    const accessToken = this.jwt.sign({ sub: userId, username });
    const refresh = await this.refreshTokens.issue(userId);
    return { accessToken, ...refresh };
  }
}
