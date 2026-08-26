import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { JwtGuard } from '../common/guards/jwt.guard';

@UseGuards(JwtGuard)
@Controller('photos')
export class PhotosController {
  // POST /photos - только владелец
  // {url, albumId, thumbnailUrl?, caption?} -> {photo}
  // 201 - OK create, 400 - bad request, 401 - unauthorized,
  // 403 - forbidden, 404 - not found
  @Post()
  createPhotos() {
    return 'TODO: create photos';
  }

  // GET /photos/:id - только access-token
  //  - -> {photo}
  // 200 - OK, 400 - bad request, 401 - unauthorized,
  // 404 - not found
  @Get(':id')
  getPhoto() {
    return 'TODO: get photo';
  }

  // GET /photos/:id/comments - только с access-token
  // - -> {comments[]}
  // 200 - OK, 400 - bad request,
  // 401 - unauthorized, 404 - not found
  @Get(':id/comments')
  checkComments() {
    return 'TODO: check comments in photos';
  }

  // PATCH /photos/:id - только владелец
  // {caption?} -> {photo}
  // 200 - OK, 400 - bad request, 401 - unauthorized,
  // 403 - forbidden, 404 - not found
  @Patch(':id')
  editPhoto() {
    return 'TODO: edit photo';
  }

  // DELETE /photos/:id - только владелец
  // - -> 204
  // 204 - OK (no content), 400 - bad request, 401 - unauthorized,
  // 403 - forbidden, 404 - not found
  @Delete(':id')
  deletePhoto() {
    return 'TODO: delete photo';
  }
}
