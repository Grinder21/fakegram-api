import { Controller, Post, Get, Body, Res, HttpCode } from '@nestjs/common';
import type { Response } from 'express';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}
  // POST /auth/register - public
  // body: {email, username, password, displayName? }
  // создать user, хэшировать пароль, отдать accessToken + поставить refresh в httpOnly cookie
  // 201 - OK, 400 - невалидное тело, 409 - email/username заняты
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { refreshToken, refreshTokenExpiresAt, ...result } =
      await this.authService.register(dto);

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      sameSite: 'strict',
      expires: refreshTokenExpiresAt,
    });

    return result;
  }

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { refreshToken, refreshTokenExpiresAt, ...result } =
      await this.authService.login(dto);

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      sameSite: 'strict',
      expires: refreshTokenExpiresAt,
    });

    return result;
  }

  // POST /auth/refresh - public
  // refresh из cookie - получить новый accessToken
  // гасить старый refresh, выдать новый
  // 200 - OK, 401 - нет/невалидный refresh-token
  @Post('refresh')
  refresh() {
    return 'TODO: refresh';
  }

  // POST /auth/logout - только с access-token
  // погасить refresh-токены user, чистить cookie
  // 204 - OK, 401 - нет/невалидный access-token
  @HttpCode(204)
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
