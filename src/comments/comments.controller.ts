import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtGuard } from '../common/guards/jwt.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/types/jwt-payload';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';

@UseGuards(JwtGuard)
@Controller('comments')
export class CommentsController {
  constructor(private commentsService: CommentsService) {}

  // POST /comments - только с access-token
  // {body, photoId} -> {comment}
  // 201 - OK create, 400 - bad request, 401 - unauthorized,
  // 404 - not found
  @Post()
  createComment(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateCommentDto,
  ) {
    return this.commentsService.create(user.sub, dto);
  }

  // DELETE /comments/:id - автор комментария или владелец фото
  // - -> 204
  // 204 - OK (no content), 400 - bad request, 401 - unauthorized,
  // 403 - forbidden, 404 - not found
  @Delete(':id')
  @HttpCode(204)
  deleteComment(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.commentsService.remove(id, user.sub);
  }
}
