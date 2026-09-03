import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  UseGuards,
  Body,
  Param,
  ParseUUIDPipe,
  Query,
  HttpCode,
} from '@nestjs/common';
import { JwtGuard } from '../common/guards/jwt.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/types/jwt-payload';
import { PaginationDto } from '../common/dto/pagination.dto';
import { PhotosService } from './photos.service';
import { CreatePhotoDto } from './dto/create-photo.dto';
import { UpdatePhotoDto } from './dto/update-photo.dto';

@UseGuards(JwtGuard)
@Controller('photos')
export class PhotosController {
  constructor(private photosService: PhotosService) {}
  // POST /photos - только владелец
  // {url, albumId, thumbnailUrl?, caption?} -> {photo}
  // 201 - OK create, 400 - bad request, 401 - unauthorized,
  // 403 - forbidden, 404 - not found
  @Post()
  createPhotos(@CurrentUser() user: JwtPayload, @Body() dto: CreatePhotoDto) {
    return this.photosService.create(user.sub, dto);
  }

  // GET /photos/:id - только access-token
  //  - -> {photo}
  // 200 - OK, 400 - bad request, 401 - unauthorized,
  // 404 - not found
  @Get(':id')
  getPhoto(@Param('id', ParseUUIDPipe) id: string) {
    return this.photosService.findOne(id);
  }

  // GET /photos/:id/comments - только с access-token
  // ?cursor&limit -> {items, hasMore, nextCursor}
  // 200 - OK, 400 - bad request,
  // 401 - unauthorized, 404 - not found
  @Get(':id/comments')
  checkComments(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.photosService.findComments(id, pagination);
  }

  // PATCH /photos/:id - только владелец
  // {caption?} -> {photo}
  // 200 - OK, 400 - bad request, 401 - unauthorized,
  // 403 - forbidden, 404 - not found
  @Patch(':id')
  editPhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdatePhotoDto,
  ) {
    return this.photosService.update(id, user.sub, dto);
  }

  // DELETE /photos/:id - только владелец
  // - -> 204
  // 204 - OK (no content), 400 - bad request, 401 - unauthorized,
  // 403 - forbidden, 404 - not found
  @Delete(':id')
  @HttpCode(204)
  deletePhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.photosService.remove(id, user.sub);
  }
}
