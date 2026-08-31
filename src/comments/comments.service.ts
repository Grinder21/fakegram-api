import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { throwIfMissing } from '../common/prisma-errors';

@Injectable()
export class CommentsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateCommentDto) {
    const photo = await this.prisma.photo.findUnique({
      where: { id: dto.photoId },
      select: { id: true },
    });

    if (!photo) {
      throw new NotFoundException('Photo not found');
    }

    return this.prisma.comment.create({
      data: {
        photoId: dto.photoId,
        userId,
        body: dto.body,
      },
    });
  }

  async remove(id: string, userId: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id },
      include: {
        photo: { select: { album: { select: { userId: true } } } },
      },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    const isAuthor = comment.userId === userId;
    const isPhotoOwner = comment.photo.album.userId === userId;

    if (!isAuthor && !isPhotoOwner) {
      throw new ForbiddenException(
        'You can delete only your own comments or comments on your photos',
      );
    }

    try {
      await this.prisma.comment.delete({ where: { id } });
    } catch (error) {
      throwIfMissing(error, 'Comment not found');
    }
  }
}
