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
import { JwtGuard } from '../common/guards/jwt.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/types/jwt-payload';
import { CurrentUserId } from '../common/decorators/current-user-id.decorator';

@Controller('auth')
export class AuthController {
  private readonly REFRESH_COOKIE = 'refreshToken';

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

    this.setRefreshCookie(res, refreshToken, refreshTokenExpiresAt);

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

    this.setRefreshCookie(res, refreshToken, refreshTokenExpiresAt);

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
    const raw: unknown = req.cookies?.[this.REFRESH_COOKIE];
    const token = typeof raw === 'string' ? raw : undefined;
    if (!token) {
      throw new UnauthorizedException('No refresh token');
    }

    const { refreshToken, refreshTokenExpiresAt, ...result } =
      await this.authService.refresh(token);

    this.setRefreshCookie(res, refreshToken, refreshTokenExpiresAt);

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
    res.clearCookie(this.REFRESH_COOKIE);
  }

  // GET /auth/me - только с access-token
  // отдать текущего user (без password_hash)
  // 200 - OK, 400 - невалидный id в токене, 401 - нет/невалидный access-token
  @UseGuards(JwtGuard)
  @Get('me')
  async me(@CurrentUserId() userId: string) {
    return this.authService.getMe(userId);
  }

  private setRefreshCookie(res: Response, token: string, expires: Date): void {
    res.cookie(this.REFRESH_COOKIE, token, {
      httpOnly: true,
      sameSite: 'strict',
      expires,
    });
  }
}
