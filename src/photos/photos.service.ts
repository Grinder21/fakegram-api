import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePhotoDto } from './dto/create-photo.dto';
import { UpdatePhotoDto } from './dto/update-photo.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { throwIfMissing } from '../common/prisma-errors';

@Injectable()
export class PhotosService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreatePhotoDto) {
    const album = await this.prisma.album.findUnique({
      where: { id: dto.albumId },
      select: { userId: true },
    });

    if (!album) {
      throw new NotFoundException('Album not found');
    }

    if (album.userId !== userId) {
      throw new ForbiddenException('You are not the owner of this album');
    }

    return this.prisma.photo.create({
      data: {
        albumId: dto.albumId,
        url: dto.url,
        thumbnailUrl: dto.thumbnailUrl,
        caption: dto.caption,
      },
    });
  }

  async findOne(id: string) {
    const photo = await this.prisma.photo.findUnique({ where: { id } });
    if (!photo) {
      throw new NotFoundException('Photo not found');
    }
    return photo;
  }

  async findComments(photoId: string, pagination: PaginationDto) {
    const limit = pagination.limit;
    const cursor = pagination.cursor;

    const photo = await this.prisma.photo.findUnique({
      where: { id: photoId },
      include: {
        comments: {
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: limit + 1,
          skip: cursor ? 1 : 0,
          cursor: cursor ? { id: cursor } : undefined,
        },
      },
    });

    if (!photo) {
      throw new NotFoundException('Photo not found');
    }

    if (cursor) {
      const cursorComment = await this.prisma.comment.findFirst({
        where: { id: cursor, photoId },
        select: { id: true },
      });

      if (!cursorComment) {
        throw new BadRequestException('Cursor does not belong to this photo');
      }
    }

    const comments = photo.comments;
    const hasMore = comments.length > limit;
    const items = hasMore ? comments.slice(0, limit) : comments;

    return {
      items,
      hasMore,
      nextCursor: hasMore ? items[items.length - 1].id : null,
    };
  }

  async update(id: string, userId: string, dto: UpdatePhotoDto) {
    await this.findOwned(id, userId);

    if (dto.caption === undefined) {
      throw new BadRequestException('No fields provided for update');
    }

    try {
      return await this.prisma.photo.update({
        where: { id },
        data: { caption: dto.caption },
      });
    } catch (error) {
      throwIfMissing(error, 'Photo not found');
    }
  }

  async remove(id: string, userId: string) {
    await this.findOwned(id, userId);

    try {
      await this.prisma.photo.delete({ where: { id } });
    } catch (error) {
      throwIfMissing(error, 'Photo not found');
    }
  }

  private async findOwned(id: string, userId: string) {
    const photo = await this.prisma.photo.findUnique({
      where: { id },
      include: { album: { select: { userId: true } } },
    });

    if (!photo) {
      throw new NotFoundException('Photo not found');
    }

    if (photo.album.userId !== userId) {
      throw new ForbiddenException('You are not the owner of this photo');
    }

    const { album: _album, ...rest } = photo;
    return rest;
  }
}
