import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAlbumDto } from './dto/create-album.dto';
import { UpdateAlbumDto } from './dto/update-album.dto';
import { Prisma } from '../generated/prisma/client';

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

  async findPhotos(albumId: string) {
    const photos = await this.prisma.photo.findMany({
      where: { albumId },
      orderBy: { createdAt: 'desc' },
    });

    if (photos.length === 0) {
      const album = await this.prisma.album.findUnique({
        where: { id: albumId },
        select: { id: true },
      });

      if (!album) {
        throw new NotFoundException('Album not found');
      }
    }

    return photos;
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
      throw this.mapMissingRecord(error, 'Album not found');
    }
  }

  async remove(id: string, userId: string) {
    await this.findOwned(id, userId);

    try {
      await this.prisma.album.delete({ where: { id } });
    } catch (error) {
      throw this.mapMissingRecord(error, 'Album not found');
    }
  }

  private async findOwned(id: string, userId: string) {
    const album = await this.findOne(id);
    if (album.userId !== userId) {
      throw new ForbiddenException('You are not the owner of this album');
    }
    return album;
  }

  private mapMissingRecord(error: unknown, message: string): unknown {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      return new NotFoundException(message);
    }
    return error;
  }
}
