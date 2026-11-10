import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { CreateAlbumDto } from './dto/create-album.dto';
import { UpdateAlbumDto } from './dto/update-album.dto';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from 'vitest';
import type { Album, Prisma, Photo } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AlbumsService } from './albums.service';

type DeleteAlbum = (args: Prisma.AlbumDeleteArgs) => Promise<{
  _count: { photos: number };
}>;

describe('AlbumsService', () => {
  let module: TestingModule;
  let service: AlbumsService;
  let findUnique: Mock<PrismaService['album']['findUnique']>;
  let createAlbum: Mock<PrismaService['album']['create']>;
  let updateAlbum: Mock<PrismaService['album']['update']>;
  let findManyPhotos: Mock<PrismaService['photo']['findMany']>;
  let deleteAlbum: Mock<DeleteAlbum>;

  const album = {
    id: '3c1e72f2-ea0d-4ce7-b26e-e792d27e256f',
    userId: '6f06b842-3ce1-4beb-a83d-2ffdf056153e',
    title: 'Summer',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  } satisfies Album;

  const photo = {
    id: 'c89b24c0-cdaf-454f-8fc8-d63412202d52',
    albumId: album.id,
    url: 'https://example.com/photo.jpg',
    thumbnailUrl: null,
    caption: null,
    createdAt: album.createdAt,
    updatedAt: album.updatedAt,
  } satisfies Photo;

  beforeEach(async () => {
    findUnique = vi.fn<PrismaService['album']['findUnique']>();
    createAlbum = vi.fn<PrismaService['album']['create']>();
    updateAlbum = vi.fn<PrismaService['album']['update']>();
    findManyPhotos = vi.fn<PrismaService['photo']['findMany']>();
    deleteAlbum = vi.fn<DeleteAlbum>();
    module = await Test.createTestingModule({
      providers: [
        AlbumsService,
        {
          provide: PrismaService,
          useValue: {
            album: {
              findUnique,
              create: createAlbum,
              update: updateAlbum,
              delete: deleteAlbum,
            },
            photo: { findMany: findManyPhotos },
          },
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

  describe('create', () => {
    it('creates an album with the given userId and title', async () => {
      const dto: CreateAlbumDto = { title: 'Summer' };
      createAlbum.mockResolvedValue(album);

      const result = await service.create(album.userId, dto);

      expect(result).toEqual(album);
      expect(createAlbum).toHaveBeenCalledExactlyOnceWith({
        data: {
          userId: album.userId,
          title: album.title,
        },
      });
    });
  });

  describe('update', () => {
    it('updates the album title when the user is its owner', async () => {
      const dto: UpdateAlbumDto = { title: 'Winter' };
      const updatedAlbum = { ...album, title: 'Winter' };

      findUnique.mockResolvedValue(album);
      updateAlbum.mockResolvedValue(updatedAlbum);

      const result = await service.update(album.id, album.userId, dto);

      expect(result).toEqual(updatedAlbum);

      expect(updateAlbum).toHaveBeenCalledExactlyOnceWith({
        where: { id: album.id },
        data: { title: dto.title },
      });
    });

    it('prohibition on updating someone elses album', async () => {
      const dto: UpdateAlbumDto = { title: 'Summer' };
      const otherUserId = 'e464b668-e250-4154-b959-8c78ebf20abe';
      findUnique.mockResolvedValue(album);

      await expect(service.update(album.id, otherUserId, dto)).rejects.toThrow(
        ForbiddenException,
      );

      expect(updateAlbum).not.toHaveBeenCalled();
    });

    it('update empty DTO', async () => {
      const dto: UpdateAlbumDto = {};
      findUnique.mockResolvedValue(album);

      await expect(service.update(album.id, album.userId, dto)).rejects.toThrow(
        BadRequestException,
      );

      expect(updateAlbum).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes the album when the user is its owner', async () => {
      findUnique.mockResolvedValue(album);
      deleteAlbum.mockResolvedValue({ _count: { photos: 2 } });

      await expect(
        service.remove(album.id, album.userId),
      ).resolves.toBeUndefined();

      expect(findUnique).toHaveBeenCalledExactlyOnceWith({
        where: { id: album.id },
      });
      expect(deleteAlbum).toHaveBeenCalledExactlyOnceWith({
        where: { id: album.id },
        select: { _count: { select: { photos: true } } },
      });
    });

    it('throws ForbiddenException when the user is not the owner', async () => {
      const otherUserId = 'e464b668-e250-4154-b959-8c78ebf20abe';
      findUnique.mockResolvedValue(album);

      await expect(service.remove(album.id, otherUserId)).rejects.toThrow(
        ForbiddenException,
      );

      expect(deleteAlbum).not.toHaveBeenCalled();
    });
  });

  describe('findPhotos', () => {
    it('returns photos without a next page when fewer than the limit exist', async () => {
      findManyPhotos.mockResolvedValue([photo]);

      const result = await service.findPhotos(album.id, album.userId, {
        limit: 2,
      });
      expect(result).toEqual({
        items: [photo],
        hasMore: false,
        nextCursor: null,
      });
    });

    it('throws NotFoundException when the album does not exist', async () => {
      findManyPhotos.mockResolvedValue([]);
      findUnique.mockResolvedValue(null);

      await expect(
        service.findPhotos(album.id, album.userId, { limit: 2 }),
      ).rejects.toThrow(NotFoundException);

      expect(findUnique).toHaveBeenCalledExactlyOnceWith({
        where: { id: album.id },
      });
    });
  });
});
