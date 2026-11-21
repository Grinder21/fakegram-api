import { Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { createHash } from 'node:crypto';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from 'vitest';
import { Prisma, type RefreshToken } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RefreshTokenService } from './refresh-token.service';
import type { PublicUser } from './types/auth-result';

type ConsumedRecord = RefreshToken & { user: PublicUser };
type RejectedRecord = Pick<
  RefreshToken,
  'userId' | 'familyId' | 'used' | 'expiresAt'
>;
type UpdateToken = (
  args: Prisma.RefreshTokenUpdateArgs,
) => Promise<ConsumedRecord>;
type FindToken = (
  args: Prisma.RefreshTokenFindUniqueArgs,
) => Promise<RejectedRecord | null>;

function prismaError(code: string) {
  return new Prisma.PrismaClientKnownRequestError(
    'Refresh token query failed',
    {
      code,
      clientVersion: Prisma.prismaVersion.client,
    },
  );
}

describe('RefreshTokenService', () => {
  let module: TestingModule;
  let service: RefreshTokenService;
  let create: Mock<PrismaService['refreshToken']['create']>;
  let update: Mock<UpdateToken>;
  let findUnique: Mock<FindToken>;
  let deleteMany: Mock<PrismaService['refreshToken']['deleteMany']>;
  let getOrThrow: Mock<(key: string) => number>;

  const now = new Date('2026-11-16T12:00:00.000Z');
  const expiresAt = new Date('2026-12-16T12:00:00.000Z');
  const rawToken = 'ab'.repeat(40);
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');
  const publicUser = {
    id: '6f06b842-3ce1-4beb-a83d-2ffdf056153e',
    username: 'alice',
    email: 'alice@example.com',
    displayName: null,
    avatarUrl: null,
    bio: null,
    createdAt: now,
    updatedAt: now,
  } satisfies PublicUser;
  const token = {
    id: 'c89b24c0-cdaf-454f-8fc8-d63412202d52',
    userId: publicUser.id,
    familyId: '3c1e72f2-ea0d-4ce7-b26e-e792d27e256f',
    tokenHash,
    used: false,
    expiresAt,
    createdAt: now,
  } satisfies RefreshToken;
  const consumedRecord = {
    ...token,
    used: true,
    user: publicUser,
  } satisfies ConsumedRecord;

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(now);

    create = vi.fn<PrismaService['refreshToken']['create']>();
    create.mockResolvedValue(token);
    update = vi.fn<UpdateToken>();
    update.mockResolvedValue(consumedRecord);
    findUnique = vi.fn<FindToken>();
    findUnique.mockResolvedValue(null);
    deleteMany = vi.fn<PrismaService['refreshToken']['deleteMany']>();
    deleteMany.mockResolvedValue({ count: 0 });
    getOrThrow = vi.fn<(key: string) => number>();
    getOrThrow.mockReturnValue(30);

    module = await Test.createTestingModule({
      providers: [
        RefreshTokenService,
        {
          provide: PrismaService,
          useValue: {
            refreshToken: { create, update, findUnique, deleteMany },
          },
        },
        { provide: ConfigService, useValue: { getOrThrow } },
      ],
    }).compile();
    service = module.get(RefreshTokenService);
  });

  afterEach(async () => {
    vi.useRealTimers();
    await module.close();
  });

  describe('issue', () => {
    it.each([
      { days: 1, expiry: new Date('2026-11-17T12:00:00.000Z') },
      { days: 30, expiry: expiresAt },
    ])(
      'stores a SHA-256 hash and applies a $days-day TTL',
      async ({ days, expiry }) => {
        getOrThrow.mockReturnValue(days);

        const result = await service.issue(publicUser.id);

        expect(result.refreshToken).toMatch(/^[0-9a-f]{80}$/);
        expect(result.refreshTokenExpiresAt).toEqual(expiry);
        expect(getOrThrow).toHaveBeenCalledExactlyOnceWith(
          'REFRESH_TOKEN_TTL_DAYS',
        );
        expect(create).toHaveBeenCalledExactlyOnceWith({
          data: {
            userId: publicUser.id,
            tokenHash: createHash('sha256')
              .update(result.refreshToken)
              .digest('hex'),
            expiresAt: expiry,
            familyId: undefined,
          },
        });
      },
    );

    it('uses the supplied transaction and preserves its token family', async () => {
      const transactionCreate =
        vi.fn<PrismaService['refreshToken']['create']>();
      transactionCreate.mockResolvedValue(token);
      const tx = {
        refreshToken: { create: transactionCreate },
      } as unknown as Prisma.TransactionClient;

      const result = await service.issue(publicUser.id, tx, token.familyId);

      expect(transactionCreate).toHaveBeenCalledExactlyOnceWith({
        data: {
          userId: publicUser.id,
          tokenHash: createHash('sha256')
            .update(result.refreshToken)
            .digest('hex'),
          expiresAt,
          familyId: token.familyId,
        },
      });
      expect(create).not.toHaveBeenCalled();
    });

    it('does not persist a token when its TTL configuration is missing', async () => {
      const error = new Error('Missing REFRESH_TOKEN_TTL_DAYS');
      getOrThrow.mockImplementation(() => {
        throw error;
      });

      await expect(service.issue(publicUser.id)).rejects.toBe(error);

      expect(create).not.toHaveBeenCalled();
    });

    it('propagates persistence failures instead of returning an issued token', async () => {
      const error = new Error('Token storage unavailable');
      create.mockRejectedValue(error);

      await expect(service.issue(publicUser.id)).rejects.toBe(error);
    });
  });

  describe('consume', () => {
    it('atomically marks an unexpired unused token as used and returns its public user', async () => {
      const result = await service.consume(rawToken);

      expect(result).toEqual({
        user: publicUser,
        userId: publicUser.id,
        familyId: token.familyId,
      });
      expect(update).toHaveBeenCalledExactlyOnceWith({
        where: { tokenHash, used: false, expiresAt: { gt: now } },
        data: { used: true },
        include: { user: { omit: { passwordHash: true } } },
      });
      expect(findUnique).not.toHaveBeenCalled();
      expect(deleteMany).not.toHaveBeenCalled();
    });

    it('consumes a token through the supplied transaction', async () => {
      const transactionUpdate = vi.fn<UpdateToken>();
      transactionUpdate.mockResolvedValue(consumedRecord);
      const tx = {
        refreshToken: { update: transactionUpdate },
      } as unknown as Prisma.TransactionClient;

      await expect(service.consume(rawToken, tx)).resolves.toEqual({
        user: publicUser,
        userId: publicUser.id,
        familyId: token.familyId,
      });

      expect(transactionUpdate).toHaveBeenCalledExactlyOnceWith({
        where: { tokenHash, used: false, expiresAt: { gt: now } },
        data: { used: true },
        include: { user: { omit: { passwordHash: true } } },
      });
      expect(update).not.toHaveBeenCalled();
    });

    it('rejects an unknown token without revoking another family', async () => {
      update.mockRejectedValue(prismaError('P2025'));

      await expect(service.consume(rawToken)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(findUnique).toHaveBeenCalledExactlyOnceWith({
        where: { tokenHash },
        select: { userId: true, familyId: true, used: true, expiresAt: true },
      });
      expect(deleteMany).not.toHaveBeenCalled();
    });

    it('looks up a tampered token by its own digest and leaves the original family intact', async () => {
      const tamperedToken = `${rawToken.slice(0, -1)}c`;
      const tamperedHash = createHash('sha256')
        .update(tamperedToken)
        .digest('hex');
      update.mockRejectedValue(prismaError('P2025'));
      findUnique.mockImplementation(({ where }) =>
        Promise.resolve(where.tokenHash === tokenHash ? token : null),
      );

      await expect(service.consume(tamperedToken)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(update).toHaveBeenCalledExactlyOnceWith({
        where: { tokenHash: tamperedHash, used: false, expiresAt: { gt: now } },
        data: { used: true },
        include: { user: { omit: { passwordHash: true } } },
      });
      expect(findUnique).toHaveBeenCalledExactlyOnceWith({
        where: { tokenHash: tamperedHash },
        select: { userId: true, familyId: true, used: true, expiresAt: true },
      });
      expect(deleteMany).not.toHaveBeenCalled();
    });

    it.each([
      { scenario: 'already expired', expiry: new Date(now.getTime() - 1) },
      { scenario: 'expiring exactly now', expiry: now },
    ])(
      'rejects a token $scenario and revokes its family',
      async ({ expiry }) => {
        update.mockRejectedValue(prismaError('P2025'));
        findUnique.mockResolvedValue({ ...token, expiresAt: expiry });

        await expect(service.consume(rawToken)).rejects.toThrow(
          UnauthorizedException,
        );

        expect(deleteMany).toHaveBeenCalledExactlyOnceWith({
          where: { familyId: token.familyId },
        });
      },
    );

    it('rejects reuse after a successful consume and revokes the whole family', async () => {
      update
        .mockResolvedValueOnce(consumedRecord)
        .mockRejectedValueOnce(prismaError('P2025'));
      findUnique.mockResolvedValue(consumedRecord);

      await expect(service.consume(rawToken)).resolves.toEqual({
        user: publicUser,
        userId: publicUser.id,
        familyId: token.familyId,
      });
      await expect(service.consume(rawToken)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(update).toHaveBeenCalledTimes(2);
      expect(deleteMany).toHaveBeenCalledExactlyOnceWith({
        where: { familyId: token.familyId },
      });
    });

    it('revokes a rejected token family outside the failed transaction', async () => {
      const transactionUpdate = vi.fn<UpdateToken>();
      transactionUpdate.mockRejectedValue(prismaError('P2025'));
      const tx = {
        refreshToken: { update: transactionUpdate },
      } as unknown as Prisma.TransactionClient;
      findUnique.mockResolvedValue(consumedRecord);

      await expect(service.consume(rawToken, tx)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(update).not.toHaveBeenCalled();
      expect(findUnique).toHaveBeenCalledExactlyOnceWith({
        where: { tokenHash },
        select: { userId: true, familyId: true, used: true, expiresAt: true },
      });
      expect(deleteMany).toHaveBeenCalledExactlyOnceWith({
        where: { familyId: token.familyId },
      });
    });

    it('does not revoke a still valid unused family after a rejected consume', async () => {
      update.mockRejectedValue(prismaError('P2025'));
      findUnique.mockResolvedValue({
        ...token,
        expiresAt: new Date(now.getTime() + 1),
      });

      await expect(service.consume(rawToken)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(deleteMany).not.toHaveBeenCalled();
    });

    it.each([
      { scenario: 'an unexpected Prisma error', error: prismaError('P2003') },
      {
        scenario: 'a connection failure',
        error: new Error('Database unavailable'),
      },
    ])('propagates $scenario without revoking sessions', async ({ error }) => {
      update.mockRejectedValue(error);

      await expect(service.consume(rawToken)).rejects.toBe(error);

      expect(findUnique).not.toHaveBeenCalled();
      expect(deleteMany).not.toHaveBeenCalled();
    });

    it.each([
      {
        scenario: 'lookup fails',
        operation: 'lookup',
        error: new Error('Lookup failed'),
      },
      {
        scenario: 'deletion fails',
        operation: 'delete',
        error: new Error('Deletion failed'),
      },
      {
        scenario: 'lookup rejects a non-Error value',
        operation: 'lookup',
        error: 'Storage unavailable',
      },
    ])(
      'still rejects the token when family cleanup $scenario',
      async ({ operation, error }) => {
        vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
        update.mockRejectedValue(prismaError('P2025'));
        if (operation === 'lookup') {
          findUnique.mockRejectedValue(error);
        } else {
          findUnique.mockResolvedValue(consumedRecord);
          deleteMany.mockRejectedValue(error);
        }

        await expect(service.consume(rawToken)).rejects.toThrow(
          UnauthorizedException,
        );

        if (operation === 'lookup') {
          expect(deleteMany).not.toHaveBeenCalled();
        } else {
          expect(deleteMany).toHaveBeenCalledExactlyOnceWith({
            where: { familyId: token.familyId },
          });
        }
      },
    );
  });

  describe('revokeAll', () => {
    it.each([0, 3])(
      'revokes all sessions successfully when %i tokens exist',
      async (count) => {
        deleteMany.mockResolvedValue({ count });

        await expect(service.revokeAll(publicUser.id)).resolves.toBeUndefined();

        expect(deleteMany).toHaveBeenCalledExactlyOnceWith({
          where: { userId: publicUser.id },
        });
      },
    );

    it('propagates failures to revoke sessions', async () => {
      const error = new Error('Session revocation failed');
      deleteMany.mockRejectedValue(error);

      await expect(service.revokeAll(publicUser.id)).rejects.toBe(error);
    });
  });
});
