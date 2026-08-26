import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { Prisma } from '../generated/prisma/client';
import { PaginationDto } from '../common/dto/pagination.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}
  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      omit: { passwordHash: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async update(id: string, userId: string, dto: UpdateUserDto) {
    if (id !== userId) {
      throw new ForbiddenException('Users do not match');
    }

    const updateData = Object.fromEntries(
      Object.entries({
        bio: dto.bio,
        displayName: dto.displayName,
        avatarUrl: dto.avatarUrl,
      }).filter(([_, value]) => value !== undefined),
    );

    const fieldsCount = Object.keys(updateData).length;

    if (fieldsCount === 0) {
      throw new BadRequestException('No fields provided for update');
    }

    try {
      return await this.prisma.user.update({
        where: { id },
        data: updateData,
        omit: { passwordHash: true },
      });
    } catch (error) {
      this.throwIfMissing(error, 'User not found');
    }
  }

  async findAlbums(userId: string, pagination: PaginationDto) {
    const limit = pagination.limit;
    const cursor = pagination.cursor;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        albums: {
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: limit + 1,
          skip: cursor ? 1 : 0,
          cursor: cursor ? { id: cursor } : undefined,
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (cursor) {
      const cursorAlbum = await this.prisma.album.findFirst({
        where: { id: cursor, userId },
        select: { id: true },
      });

      if (!cursorAlbum) {
        throw new BadRequestException('Cursor does not belong to this user');
      }
    }

    const albums = user.albums;
    const hasMore = albums.length > limit;
    const items = hasMore ? albums.slice(0, limit) : albums;

    return {
      items,
      hasMore,
      nextCursor: hasMore ? items[items.length - 1].id : null,
    };
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
