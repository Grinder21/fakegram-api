import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAlbumDto } from './dto/create-album.dto';
import { UpdateAlbumDto } from './dto/update-album.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { throwIfMissing } from '../common/prisma-errors';

@Injectable()
export class AlbumsService {
  private readonly logger = new Logger(AlbumsService.name);

  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateAlbumDto) {
    const album = await this.prisma.album.create({
      data: { userId, title: dto.title },
    });
    this.logger.log(`Album created (album ${album.id}, user ${userId})`);
    return album;
  }

  async findOne(id: string, viewerId: string) {
    const album = await this.prisma.album.findUnique({ where: { id } });
    if (!album) {
      throw new NotFoundException('Album not found');
    }
    if (album.userId !== viewerId) {
      throw new ForbiddenException('You are not the owner of this album');
    }
    return album;
  }

  async findPhotos(
    albumId: string,
    viewerId: string,
    pagination: PaginationDto,
  ) {
    const limit = pagination.limit;
    const cursor = pagination.cursor;

    if (cursor) {
      const cursorPhoto = await this.prisma.photo.findFirst({
        where: { id: cursor, albumId },
        select: { id: true },
      });

      if (!cursorPhoto) {
        await this.findOne(albumId, viewerId);
        throw new BadRequestException('Cursor does not belong to this album');
      }
    }

    const photos = await this.prisma.photo.findMany({
      where: { albumId, album: { userId: viewerId } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
    });

    if (photos.length === 0) {
      await this.findOne(albumId, viewerId);
    }

    const hasMore = photos.length > limit;
    const items = hasMore ? photos.slice(0, limit) : photos;

    return {
      items,
      hasMore,
      nextCursor: hasMore ? items[items.length - 1].id : null,
    };
  }

  async update(id: string, userId: string, dto: UpdateAlbumDto) {
    await this.findOne(id, userId);

    if (dto.title === undefined) {
      throw new BadRequestException('No fields provided for update');
    }

    try {
      return await this.prisma.album.update({
        where: { id },
        data: { title: dto.title },
      });
    } catch (error) {
      throwIfMissing(error, 'Album not found');
    }
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);

    try {
      const deleted = await this.prisma.album.delete({
        where: { id },
        select: { _count: { select: { photos: true } } },
      });
      this.logger.log(
        `Album deleted with ${deleted._count.photos} photo(s) (album ${id}, user ${userId})`,
      );
    } catch (error) {
      throwIfMissing(error, 'Album not found');
    }
  }
}
