import {
  ConflictException,
  Injectable,
  Logger,
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
  private readonly logger = new Logger(AuthService.name);

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
            if (error instanceof Prisma.PrismaClientKnownRequestError) {
              this.logger.warn(
                `Registration failed. Duplicate fields: ${JSON.stringify(error.meta)}`,
              );
            } else {
              this.logger.warn(
                'Registration failed due to unique constraint conflict',
              );
            }
            throw new ConflictException('Registration failed');
          }
          throw error;
        });

      const tokens = await this.issueSession(user.id, user.username, { tx });
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
    return this.prisma.$transaction(async (tx) => {
      const { user, userId, familyId } = await this.refreshTokens.consume(
        cookieToken,
        tx,
      );
      const tokens = await this.issueSession(userId, user.username, {
        tx,
        familyId,
      });
      return { user, ...tokens };
    });
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
    {
      tx = this.prisma,
      familyId,
    }: { tx?: Prisma.TransactionClient; familyId?: string } = {},
  ) {
    const accessToken = this.jwt.sign({ sub: userId, username });
    const refresh = await this.refreshTokens.issue(userId, tx, familyId);
    return {
      accessToken,
      refreshToken: refresh.refreshToken,
      refreshTokenExpiresAt: refresh.refreshTokenExpiresAt,
    };
  }
}
