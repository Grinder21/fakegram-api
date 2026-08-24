import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AlbumsService } from './albums.service';
import { CreateAlbumDto } from './dto/create-album.dto';
import { UpdateAlbumDto } from './dto/update-album.dto';
import { JwtGuard } from '../common/guards/jwt.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/types/jwt-payload';
import { PaginationDto } from '../common/dto/pagination.dto';

@UseGuards(JwtGuard)
@Controller('albums')
export class AlbumsController {
  constructor(private albumsService: AlbumsService) {}

  // POST /albums - только access-token
  // {title} -> {album}
  // 201 - OK create, 400 - bad request, 401 - unauthorized
  @Post()
  createAlbum(@CurrentUser() user: JwtPayload, @Body() dto: CreateAlbumDto) {
    return this.albumsService.create(user.sub, dto);
  }

  // GET /albums/:id - только access-token
  //  - -> {album}
  // 200 - OK, 400 - bad request, 401 - unauthorized,
  // 404 - not found
  @Get(':id')
  getAlbum(@Param('id', ParseUUIDPipe) id: string) {
    return this.albumsService.findOne(id);
  }

  // GET /albums/:id/photos - только с access-token
  // - -> {items, hasMore, nextCursor}
  // 200 - OK, 400 - bad request,
  // 401 - unauthorized, 404 - not found
  @Get(':id/photos')
  checkPhotos(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.albumsService.findPhotos(id, pagination);
  }

  // PATCH /albums/:id - только владелец
  // {title?} -> {album}
  // 200 - OK, 400 - bad request, 401 - unauthorized,
  // 403 - forbidden, 404 - not found
  @Patch(':id')
  editAlbum(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateAlbumDto,
  ) {
    return this.albumsService.update(id, user.sub, dto);
  }

  // DELETE /albums/:id - только владелец
  // - -> 204
  // 204 - OK (no content), 400 - bad request, 401 - unauthorized,
  // 403 - forbidden, 404 - not found
  @Delete(':id')
  @HttpCode(204)
  deleteAlbum(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.albumsService.remove(id, user.sub);
  }
}
