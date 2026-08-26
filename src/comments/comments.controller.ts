import { Controller, Post, Delete, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../common/guards/jwt.guard';

@UseGuards(JwtGuard)
@Controller('comments')
export class CommentsController {
  // POST /comments - только с access-token
  // {body, photoId} -> {comment}
  // 201 - OK create, 400 - bad request, 401 - unauthorized,
  // 404 - not found
  @Post()
  createComment() {
    return 'TODO: create comments';
  }

  // DELETE /comments/:id - только владелец
  // - -> 204
  // 204 - OK (not content), 400 - bad request, 401 - unauthorized,
  // 403 - forbidden, 404 - not found
  @Delete(':id')
  deleteComment() {
    return 'TODO: delete comment';
  }
}
