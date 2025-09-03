import { Controller, Post, Body, HttpCode, HttpStatus, Res, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { LoginDto } from './dto/login.dto';
import { ApiResponse } from 'src/common/interfaces/api-response.interface';
import { Response, Request } from 'express';
import { setAuthCookies, clearAuthCookies } from 'src/common/utils/cookie.util';
import { REFRESH_TOKEN_COOKIE } from 'src/common/constants/auth.constants';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() createUserDto: CreateUserDto, @Res({ passthrough: true }) res: Response): Promise<ApiResponse> {
    const result = await this.authService.register(createUserDto);
    setAuthCookies(res, result.access_token, result.refresh_token);
    return {
      success: true,
      data: { user: result.user },
      message: 'User registered successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto, @Res({ passthrough: true }) res: Response): Promise<ApiResponse> {
    const result = await this.authService.login(loginDto);
    setAuthCookies(res, result.access_token, result.refresh_token);
    return {
      success: true,
      data: { user: result.user, access_token: result.access_token, },
      message: 'Login successful',
      timestamp: new Date().toISOString(),
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<ApiResponse> {
    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];
    const result = await this.authService.refreshTokensUsingRefreshToken(refreshToken);
    setAuthCookies(res, result.access_token, result.refresh_token);
    return {
      success: true,
      data: { user: result.user },
      message: 'Tokens refreshed',
      timestamp: new Date().toISOString(),
    };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: any, @Res({ passthrough: true }) res: Response): Promise<ApiResponse> {
    clearAuthCookies(res);
    await this.authService.logout(req.user._id);
    return {
      success: true,
      data: null,
      message: 'Logged out',
      timestamp: new Date().toISOString(),
    };
  }
}