import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  HttpCode,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthService } from './auth.service';
import { JwtGuard } from './guards/jwt.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import type { JwtPayload } from './types/jwt-payload';

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

  // POST /auth/login - public
  // body: {email, password}
  // проверить пароль, отдать accessToken + поставить refresh cookie
  // 200 - OK, 400 - тело, 401 - неверные credentials
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
  @HttpCode(200)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const raw: unknown = req.cookies?.refreshToken;
    const token = typeof raw === 'string' ? raw : undefined;
    if (!token) {
      throw new UnauthorizedException('No refresh token');
    }

    const { refreshToken, refreshTokenExpiresAt, ...result } =
      await this.authService.refresh(token);

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      sameSite: 'strict',
      expires: refreshTokenExpiresAt,
    });

    return result;
  }

  // POST /auth/logout - только с access-token
  // погасить все refresh-токены user (выход со всех устройств), чистить cookie
  // 204 - OK, 401 - нет/невалидный access-token
  @UseGuards(JwtGuard)
  @HttpCode(204)
  @Post('logout')
  async logout(
    @CurrentUser() user: JwtPayload,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logout(user.sub);
    res.clearCookie('refreshToken');
  }

  // GET /auth/me - только с access-token
  // отдать текущего user (без password_hash)
  // 200 - OK, 401 - нет/невалидный access-token
  @UseGuards(JwtGuard)
  @Get('me')
  async me(@CurrentUser() user: JwtPayload) {
    return this.authService.getMe(user.sub);
  }
}
