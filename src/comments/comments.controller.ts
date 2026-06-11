import { Controller, Post, Delete } from '@nestjs/common';

@Controller('comments')
export class CommentsController {
  // POST /comments - только с access-token
  // {body, photoId} -> {comment}
  // 201 - OK create, 400 - bad request, 401 - unauthorized,
  // 403 - forbidden, 404 - not found
  @Post()
  editComments() {
    return 'TODO: edit comments';
  }

  // DELETE /comments/:id - только с access-token
  // - -> 204
  // 204 - OK (not content), 400 - bad request, 401 - unauthorized,
  // 403 - forbidden, 404 - not found
  @Delete(':id')
  deleteComment() {
    return 'TODO: delete comment';
  }
}
