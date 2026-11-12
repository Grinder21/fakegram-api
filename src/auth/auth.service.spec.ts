import { JwtService } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from 'vitest';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import { RefreshTokenService } from './refresh-token.service';
import { Prisma } from '../generated/prisma/client';
import type { PublicUser } from './types/auth-result';
import { UnauthorizedException } from '@nestjs/common';
import type { LoginDto } from './dto/login.dto';

const { comparePassword } = vi.hoisted(() => ({
  comparePassword:
    vi.fn<(password: string, hash: string) => Promise<boolean>>(),
}));

vi.mock('bcrypt', () => ({
  compare: comparePassword,
}));

type FindPublicUser = (
  args: Prisma.UserFindUniqueOrThrowArgs,
) => Promise<PublicUser>;

describe('AuthService', () => {
  let module: TestingModule;
  let service: AuthService;
  let revokeAll: Mock<RefreshTokenService['revokeAll']>;
  let findUnique: Mock<PrismaService['user']['findUnique']>;
  let findUniqueOrThrow: Mock<FindPublicUser>;
  let sign: Mock<JwtService['sign']>;
  let issue: Mock<RefreshTokenService['issue']>;

  const publicUser = {
    id: '6f06b842-3ce1-4beb-a83d-2ffdf056153e',
    username: 'alice',
    email: 'alice@example.com',
    displayName: null,
    avatarUrl: null,
    bio: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  } satisfies PublicUser;

  beforeEach(async () => {
    comparePassword.mockReset();
    revokeAll = vi.fn<RefreshTokenService['revokeAll']>();
    findUniqueOrThrow = vi.fn<FindPublicUser>();
    findUnique = vi.fn<PrismaService['user']['findUnique']>();
    sign = vi.fn<JwtService['sign']>();
    issue = vi.fn<RefreshTokenService['issue']>();
    module = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: { user: { findUniqueOrThrow, findUnique } },
        },
        { provide: JwtService, useValue: { sign } },
        {
          provide: RefreshTokenService,
          useValue: { revokeAll, issue },
        },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  afterEach(async () => {
    await module.close();
  });

  describe('logout', () => {
    it('revokes all refresh tokens for the user', async () => {
      const userId = '6f06b842-3ce1-4beb-a83d-2ffdf056153e';
      revokeAll.mockResolvedValue(undefined);
      await expect(service.logout(userId)).resolves.toBeUndefined();
      expect(revokeAll).toHaveBeenCalledExactlyOnceWith(userId);
    });
  });

  describe('getMe', () => {
    it('returns the user without the password hash', async () => {
      findUniqueOrThrow.mockResolvedValue(publicUser);

      const result = await service.getMe(publicUser.id);
      expect(result).toEqual(publicUser);

      expect(findUniqueOrThrow).toHaveBeenCalledExactlyOnceWith({
        where: { id: publicUser.id },
        omit: { passwordHash: true },
      });
    });

    it('propagates the Prisma error when the user does not exist', async () => {
      const error = new Prisma.PrismaClientKnownRequestError('User not found', {
        code: 'P2025',
        clientVersion: Prisma.prismaVersion.client,
      });

      findUniqueOrThrow.mockRejectedValue(error);

      await expect(service.getMe(publicUser.id)).rejects.toBe(error);
    });
  });

  describe('login', () => {
    it('throws UnauthorizedException when the email is unknown', async () => {
      const dto: LoginDto = {
        email: 'missing@example.com',
        password: 'Password123!',
      };

      findUnique.mockResolvedValue(null);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);

      expect(findUnique).toHaveBeenCalledExactlyOnceWith({
        where: { email: dto.email },
      });
    });

    it('throws UnauthorizedException when the password is incorrect', async () => {
      const dto: LoginDto = {
        email: publicUser.email,
        password: 'WrongPassword123!',
      };

      const user = {
        ...publicUser,
        passwordHash: 'stored-password-hash',
      };

      findUnique.mockResolvedValue(user);
      comparePassword.mockResolvedValue(false);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);

      expect(comparePassword).toHaveBeenCalledExactlyOnceWith(
        dto.password,
        user.passwordHash,
      );
    });

    it('returns the public user and tokens when credentials are valid', async () => {
      const dto: LoginDto = {
        email: publicUser.email,
        password: 'Password123!',
      };

      const user = {
        ...publicUser,
        passwordHash: 'stored-password-hash',
      };

      const refresh = {
        refreshToken: 'refresh-token',
        refreshTokenExpiresAt: new Date('2026-12-01T00:00:00.000Z'),
      };

      findUnique.mockResolvedValue(user);
      comparePassword.mockResolvedValue(true);
      sign.mockReturnValue('access-token');
      issue.mockResolvedValue(refresh);

      const result = await service.login(dto);

      expect(result).toEqual({
        user: publicUser,
        accessToken: 'access-token',
        ...refresh,
      });

      expect(sign).toHaveBeenCalledExactlyOnceWith({
        sub: user.id,
        username: user.username,
      });

      expect(issue).toHaveBeenCalledExactlyOnceWith(
        user.id,
        module.get(PrismaService),
        undefined,
      );
    });
  });
});
