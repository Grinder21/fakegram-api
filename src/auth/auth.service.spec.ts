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
import type { AuthResult, PublicUser } from './types/auth-result';
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';

const { comparePassword, hashPassword } = vi.hoisted(() => ({
  comparePassword:
    vi.fn<(password: string, hash: string) => Promise<boolean>>(),
  hashPassword: vi.fn<(password: string, rounds: number) => Promise<string>>(),
}));

vi.mock('bcrypt', () => ({
  compare: comparePassword,
  hash: hashPassword,
}));

type FindPublicUser = (
  args: Prisma.UserFindUniqueOrThrowArgs,
) => Promise<PublicUser>;

type CreatePublicUser = (args: Prisma.UserCreateArgs) => Promise<PublicUser>;

type TestTx = {
  user: { create: Mock<CreatePublicUser> };
};

type RunAuthTransaction = (
  callback: (tx: TestTx) => Promise<AuthResult>,
) => Promise<AuthResult>;

describe('AuthService', () => {
  let module: TestingModule;
  let service: AuthService;
  let revokeAll: Mock<RefreshTokenService['revokeAll']>;
  let findUnique: Mock<PrismaService['user']['findUnique']>;
  let findUniqueOrThrow: Mock<FindPublicUser>;
  let sign: Mock<JwtService['sign']>;
  let issue: Mock<RefreshTokenService['issue']>;
  let consume: Mock<RefreshTokenService['consume']>;
  let createUser: Mock<CreatePublicUser>;
  let transaction: Mock<RunAuthTransaction>;
  let tx: TestTx;

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
    createUser = vi.fn<CreatePublicUser>();
    tx = { user: { create: createUser } };
    transaction = vi.fn<RunAuthTransaction>();
    transaction.mockImplementation((callback) => callback(tx));
    comparePassword.mockReset();
    hashPassword.mockReset();
    revokeAll = vi.fn<RefreshTokenService['revokeAll']>();
    findUniqueOrThrow = vi.fn<FindPublicUser>();
    findUnique = vi.fn<PrismaService['user']['findUnique']>();
    sign = vi.fn<JwtService['sign']>();
    issue = vi.fn<RefreshTokenService['issue']>();
    consume = vi.fn<RefreshTokenService['consume']>();
    module = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: {
            user: { findUniqueOrThrow, findUnique },
            $transaction: transaction,
          },
        },
        { provide: JwtService, useValue: { sign } },
        {
          provide: RefreshTokenService,
          useValue: { revokeAll, issue, consume },
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

  describe('register', () => {
    it('creates a user and returns tokens', async () => {
      const dto: RegisterDto = {
        email: publicUser.email,
        username: publicUser.username,
        password: 'Password123!',
      };

      const refresh = {
        refreshToken: 'refresh-token',
        refreshTokenExpiresAt: new Date('2026-12-01T00:00:00.000Z'),
      };

      hashPassword.mockResolvedValue('hashed-password');
      createUser.mockResolvedValue(publicUser);
      sign.mockReturnValue('access-token');
      issue.mockResolvedValue(refresh);

      const result = await service.register(dto);
      expect(result).toEqual({
        user: publicUser,
        accessToken: 'access-token',
        ...refresh,
      });

      expect(hashPassword).toHaveBeenCalledExactlyOnceWith(dto.password, 10);

      expect(createUser).toHaveBeenCalledExactlyOnceWith({
        data: {
          email: dto.email,
          username: dto.username,
          passwordHash: 'hashed-password',
          displayName: dto.displayName,
        },
        omit: { passwordHash: true },
      });

      expect(sign).toHaveBeenCalledExactlyOnceWith({
        sub: publicUser.id,
        username: publicUser.username,
      });

      expect(issue).toHaveBeenCalledExactlyOnceWith(
        publicUser.id,
        tx,
        undefined,
      );
    });

    it('throws ConflictException when the email is already taken', async () => {
      const dto: RegisterDto = {
        email: publicUser.email,
        username: 'new-user',
        password: 'Password123!',
      };

      const error = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: Prisma.prismaVersion.client,
          meta: { target: ['email'] },
        },
      );

      hashPassword.mockResolvedValue('hashed-password');
      createUser.mockRejectedValue(error);

      await expect(service.register(dto)).rejects.toThrow(ConflictException);

      expect(sign).not.toHaveBeenCalled();
      expect(issue).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the username is already taken', async () => {
      const dto: RegisterDto = {
        email: 'new@example.com',
        username: publicUser.username,
        password: 'Password123!',
      };

      const error = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: Prisma.prismaVersion.client,
          meta: { target: ['username'] },
        },
      );

      hashPassword.mockResolvedValue('hashed-password');
      createUser.mockRejectedValue(error);

      await expect(service.register(dto)).rejects.toThrow(ConflictException);

      expect(sign).not.toHaveBeenCalled();
      expect(issue).not.toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    it('returns new tokens using the same transaction and token family', async () => {
      const cookieToken = 'current-refresh-token';
      const familyId = '3c1e72f2-ea0d-4ce7-b26e-e792d27e256f';
      const refresh = {
        refreshToken: 'new-refresh-token',
        refreshTokenExpiresAt: new Date('2026-12-01T00:00:00.000Z'),
      };

      consume.mockResolvedValue({
        user: publicUser,
        userId: publicUser.id,
        familyId,
      });
      sign.mockReturnValue('new-access-token');
      issue.mockResolvedValue(refresh);

      const result = await service.refresh(cookieToken);

      expect(result).toEqual({
        user: publicUser,
        accessToken: 'new-access-token',
        ...refresh,
      });
      expect(transaction).toHaveBeenCalledExactlyOnceWith(expect.any(Function));
      expect(consume).toHaveBeenCalledExactlyOnceWith(cookieToken, tx);
      expect(sign).toHaveBeenCalledExactlyOnceWith({
        sub: publicUser.id,
        username: publicUser.username,
      });
      expect(issue).toHaveBeenCalledExactlyOnceWith(
        publicUser.id,
        tx,
        familyId,
      );
    });

    it('propagates a rejected refresh token without issuing new tokens', async () => {
      const cookieToken = 'invalid-refresh-token';
      const error = new UnauthorizedException(
        'Refresh token expired or not found',
      );
      consume.mockRejectedValue(error);

      await expect(service.refresh(cookieToken)).rejects.toBe(error);

      expect(transaction).toHaveBeenCalledExactlyOnceWith(expect.any(Function));
      expect(consume).toHaveBeenCalledExactlyOnceWith(cookieToken, tx);
      expect(sign).not.toHaveBeenCalled();
      expect(issue).not.toHaveBeenCalled();
    });
  });
});
