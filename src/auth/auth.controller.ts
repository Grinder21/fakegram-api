import { Controller, Post, Get } from '@nestjs/common';

@Controller('auth')
export class AuthController {
  // POST /auth/register - public
  // body: {email, username, password, displayName? }
  // создать user, хэшировать пароль, отдать accessToken + поставить refresh в httpOnly cookie
  // 201 - OK, 400 - невалидное тело, 409 - email/username заняты
  @Post('register')
  register() {
    return 'TODO: register';
  }

  // POST /auth/login - public
  // body: {email, password}
  // проверить пароль, отдать accessToken + поставить refresh cookie
  // 201 - OK, 400 - тело, 401 - неверные credentials
  @Post('login')
  login() {
    return 'TODO: login';
  }

  // POST /auth/logout - только с access-token
  // погасить refresh-токены user, чистить cookie
  // 204 - OK, 401 - нет/невалидный access-token
  @Post('logout')
  logout() {
    return 'TODO: logout';
  }

  // GET /auth/me - только с access-token
  // отдать текущего user (без password_hash)
  // 200 - OK, 401 - нет/невалидный access-token
  @Get('me')
  me() {
    return 'TODO: me';
  }
}
