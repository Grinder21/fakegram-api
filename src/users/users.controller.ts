import { Controller, Get, Patch } from '@nestjs/common';

@Controller('users')
export class UsersController {
  // GET /users/:id - только с access-token
  // ответ - информация по user
  // 200 - OK, 401 - unauthorized, 404 - not found
  @Get(':id')
  getUser() {
    return 'TODO: get user';
  }

  // PATCH /users/:id - только с access-token
  // {displayName?, avatarUrl?, bio?} -> {user}
  // 200 - OK, 400 - Bad Request, 401 - unauthorized,
  // 403 - forbidden, 404 - not found
  @Patch(':id')
  editUser() {
    return 'TODO: edit user';
  }

  // GET /users/:id/albums — только с access-token
  // - -> {albums[]}
  // 200 - OK, 400 - Bad Request, 401 - unauthorized,
  // 403 - forbidden, 404 - not found
  @Get(':id/albums')
  findAlbums() {
    return 'TODO';
  }
}
