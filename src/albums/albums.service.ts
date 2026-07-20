import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAlbumDto } from './dto/create-album.dto';
import { UpdateAlbumDto } from './dto/update-album.dto';

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
    await this.findOne(albumId);

    return this.prisma.photo.findMany({
      where: { albumId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(id: string, userId: string, dto: UpdateAlbumDto) {
    await this.findOwned(id, userId);

    return this.prisma.album.update({
      where: { id },
      data: { title: dto.title },
    });
  }

  async remove(id: string, userId: string) {
    await this.findOwned(id, userId);
    await this.prisma.album.delete({ where: { id } });
  }

  private async findOwned(id: string, userId: string) {
    const album = await this.findOne(id);
    if (album.userId !== userId) {
      throw new ForbiddenException('You are not the owner of this album');
    }
    return album;
  }
}
