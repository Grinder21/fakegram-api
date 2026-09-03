import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtGuard } from '../common/guards/jwt.guard';
import { UsersService } from './users.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UpdateUserDto } from './dto/update-user.dto';
import type { JwtPayload } from '../common/types/jwt-payload';
import { PaginationDto } from '../common/dto/pagination.dto';

@UseGuards(JwtGuard)
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}
  // GET /users/:id - только с access-token
  // ответ - информация по user
  // 200 - OK, 400 - Bad Request, 401 - unauthorized, 404 - not found
  @Get(':id')
  getUser(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOne(id);
  }

  // PATCH /users/:id - только владелец
  // {displayName?, avatarUrl?, bio?} -> {user}
  // 200 - OK, 400 - Bad Request, 401 - unauthorized,
  // 403 - forbidden, 404 - not found
  @Patch(':id')
  editUser(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.update(id, user.sub, dto);
  }

  // GET /users/:id/albums — только с access-token
  // ?cursor&limit -> {items, hasMore, nextCursor}
  // 200 - OK, 400 - Bad Request, 401 - unauthorized,
  // 404 - not found
  @Get(':id/albums')
  findAlbums(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.usersService.findAlbums(id, pagination);
  }
}
