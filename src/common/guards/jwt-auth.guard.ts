import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ExecutionContext } from '@nestjs/common';
import { AuthService } from 'src/modules/auth/auth.service';
import { setAuthCookies } from '../utils/cookie.util';
import { REFRESH_TOKEN_COOKIE } from '../constants/auth.constants';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly authService: AuthService) {
    super();
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    if (user && !err) {
      return user;
    }

    const tokenExpired =
      info && (info.name === 'TokenExpiredError' || (typeof info.message === 'string' && info.message.toLowerCase().includes('expired')));

    if (tokenExpired) {
      const refreshToken = request.cookies?.[REFRESH_TOKEN_COOKIE];
      if (!refreshToken) {
        throw new UnauthorizedException('Access token expired and no refresh token provided');
      }

      return this.authService
        .refreshTokensUsingRefreshToken(refreshToken)
        .then((result) => {
          setAuthCookies(response, result.access_token, result.refresh_token);
          request.user = result.user;
          return result.user;
        })
        .catch(() => {
          throw new UnauthorizedException('Token refresh failed');
        });
    }

    if (err) {
      throw err;
    }
    throw new UnauthorizedException();
  }
}