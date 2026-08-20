import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAlbumDto } from './dto/create-album.dto';
import { UpdateAlbumDto } from './dto/update-album.dto';
import { Prisma } from '../generated/prisma/client';
import { PaginationDto } from '../common/dto/pagination.dto';

@Injectable()
export class AlbumsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateAlbumDto) {
    return this.prisma.album.create({
      data: { userId, title: dto.title },
    });
  }

  async findOne(id: string) {
    const album = await this.prisma.album.findUnique({ where: { id } });
    if (!album) {
      throw new NotFoundException('Album not found');
    }
    return album;
  }

  async findPhotos(albumId: string, pagination: PaginationDto) {
    const limit = pagination.limit ?? 20;
    const cursor = pagination.cursor;
    const album = await this.prisma.album.findUnique({
      where: { id: albumId },
      include: {
        photos: {
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: limit + 1,
          skip: cursor ? 1 : 0,
          cursor: cursor ? { id: cursor } : undefined,
        },
      },
    });

    if (!album) {
      throw new NotFoundException('Album not found');
    }

    const photos = album.photos;
    const hasMore = photos.length > limit;
    const items = hasMore ? photos.slice(0, limit) : photos;

    return {
      items,
      hasMore,
      nextCursor: hasMore ? items[items.length - 1].id : null,
    };
  }

  async update(id: string, userId: string, dto: UpdateAlbumDto) {
    const album = await this.findOwned(id, userId);

    if (dto.title === undefined) {
      return album;
    }

    try {
      return await this.prisma.album.update({
        where: { id },
        data: { title: dto.title },
      });
    } catch (error) {
      this.throwIfMissing(error, 'Album not found');
    }
  }

  async remove(id: string, userId: string) {
    await this.findOwned(id, userId);

    try {
      await this.prisma.album.delete({ where: { id } });
    } catch (error) {
      this.throwIfMissing(error, 'Album not found');
    }
  }

  private async findOwned(id: string, userId: string) {
    const album = await this.findOne(id);
    if (album.userId !== userId) {
      throw new ForbiddenException('You are not the owner of this album');
    }
    return album;
  }

  private throwIfMissing(error: unknown, message: string): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      throw new NotFoundException(message);
    }
    throw error;
  }
}
