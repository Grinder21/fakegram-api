import { ForbiddenException, NotFoundException } from '@nestjs/common';
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
import type { Album } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AlbumsService } from './albums.service';

describe('AlbumsService', () => {
  let module: TestingModule;
  let service: AlbumsService;
  let findUnique: Mock<PrismaService['album']['findUnique']>;

  const album = {
    id: '3c1e72f2-ea0d-4ce7-b26e-e792d27e256f',
    userId: '6f06b842-3ce1-4beb-a83d-2ffdf056153e',
    title: 'Summer',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  } satisfies Album;

  beforeEach(async () => {
    findUnique = vi.fn<PrismaService['album']['findUnique']>();
    module = await Test.createTestingModule({
      providers: [
        AlbumsService,
        {
          provide: PrismaService,
          useValue: { album: { findUnique } },
        },
      ],
    }).compile();

    service = module.get(AlbumsService);
  });

  afterEach(async () => {
    await module.close();
  });

  describe('findOne', () => {
    it('returns the album to its owner', async () => {
      findUnique.mockResolvedValue(album);

      const result = await service.findOne(album.id, album.userId);

      expect(result).toEqual(album);
      expect(findUnique).toHaveBeenCalledExactlyOnceWith({
        where: { id: album.id },
      });
    });

    it('throws NotFoundException when the album does not exist', async () => {
      findUnique.mockResolvedValue(null);

      await expect(service.findOne(album.id, album.userId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when the viewer is not the owner', async () => {
      findUnique.mockResolvedValue(album);

      await expect(
        service.findOne(album.id, 'e464b668-e250-4154-b959-8c78ebf20abe'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
