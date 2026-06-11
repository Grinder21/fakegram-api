import { Controller, Post, Get, Patch, Delete } from '@nestjs/common';

@Controller('albums')
export class AlbumsController {
  // POST /albums - только access-token
  // {title} -> {album}
  // 201 - OK create, 400 - bad request, 401 - unauthorized,
  // 403 - forbidden, 404 - not found
  @Post()
  createAlbum() {
    return 'TODO: create album';
  }

  // GET /albums/:id - только access-token
  //  - -> {album}
  // 200 - OK, 400 - bad request, 401 - unauthorized,
  // 403 - forbidden, 404 - not found
  @Get(':id')
  getAlbum() {
    return 'TODO: get album';
  }

  // GET /albums/:id/photos - только с access-token
  // - -> {photos[]}
  // 200 - OK, 204 - OK (not content), 400 - bad request,
  // 401 - unauthorized, 403 - forbidden, 404 - not found
  @Get(':id/photos')
  checkPhotos() {
    return 'TODO: check photos in albums';
  }

  // PATCH /albums/:id - только access-token
  // {title?} -> {album}
  // 200 - OK, 400 - bad request, 401 - unauthorized,
  // 403 - forbidden, 404 - not found
  @Patch(':id')
  editAlbum() {
    return 'TODO: edit album';
  }

  // DELETE /albums/:id - только access-token
  // - -> 204
  // 204 - OK (no content), 400 - bad request, 401 - unauthorized,
  // 403 - forbidden, 404 - not found
  @Delete(':id')
  deleteAlbum() {
    return 'TODO: delete album';
  }
}
