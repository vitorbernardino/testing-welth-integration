import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { LoginDto } from './dto/login.dto';
import { User } from '../users/schemas/user.schema';
import { UsersService } from '../users/user.service';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import {
  ACCESS_TOKEN_EXPIRES_IN,
  REFRESH_TOKEN_EXPIRES_IN,
} from 'src/common/constants/auth.constants';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  private async getTokens(user: { _id: string; email: string }) {
    const payload = { email: user.email, sub: user._id };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('JWT_SECRET') || 'your-secret-key',
      expiresIn: ACCESS_TOKEN_EXPIRES_IN,
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET') || 'your-refresh-secret',
      expiresIn: REFRESH_TOKEN_EXPIRES_IN,
    });

    return { accessToken, refreshToken };
  }

  private refreshJwtToDate(expiresIn: string): Date {
    const now = Date.now();
    const match = expiresIn.match(/^(\d+)([mhd])$/);
    if (!match) return new Date(now);
    const amount = parseInt(match[1], 10);
    const unit = match[2];
    const map = { m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };
    return new Date(now + amount * (map as any)[unit]);
  }

  private async persistRefreshToken(userId: string, refreshToken: string): Promise<void> {
    const hash = await bcrypt.hash(refreshToken, 12);
    const expiresAt = this.refreshJwtToDate(REFRESH_TOKEN_EXPIRES_IN);
    await this.usersService.setRefreshToken(userId, hash, expiresAt);
  }

  async register(createUserDto: CreateUserDto) {
    const user = await this.usersService.create(createUserDto);
    const tokens = await this.getTokens({ _id: user._id, email: user.email });
    await this.persistRefreshToken(user._id, tokens.refreshToken);
    return {
      user,
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
    };
  }

  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto.email, loginDto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const tokens = await this.getTokens({ _id: user._id, email: user.email });
    await this.persistRefreshToken(user._id, tokens.refreshToken);
    return {
      user,
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
    };
  }

  async refreshTokensUsingRefreshToken(refreshToken: string) {
    try {
      const payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET') || 'your-refresh-secret',
      });
      const authState = await this.usersService.getAuthState(payload.sub);
      if (!authState || !authState.refreshTokenHash) {
        throw new UnauthorizedException('Invalid refresh token state');
      }

      const isValid = await bcrypt.compare(refreshToken, authState.refreshTokenHash);
      if (!isValid) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const tokens = await this.getTokens({ _id: payload.sub, email: payload.email });
      await this.persistRefreshToken(payload.sub, tokens.refreshToken);

      const user = await this.usersService.findById(payload.sub);
      return {
        user,
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
      };
    } catch {
      throw new UnauthorizedException('Refresh token validation failed');
    }
  }

  async logout(userId: string): Promise<void> {
    await this.usersService.clearRefreshToken(userId);
  }

  async validateUser(email: string, password: string): Promise<User | null> {
    return this.usersService.validateUser(email, password);
  }
}