import { ExtractJwt, Strategy, JwtFromRequestFunction } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from 'src/modules/users/user.service';
import { ACCESS_TOKEN_COOKIE } from 'src/common/constants/auth.constants';

const cookieExtractor: JwtFromRequestFunction = (req) => {
  const cookies = (req as any)?.cookies;
  if (cookies && cookies[ACCESS_TOKEN_COOKIE]) {
    return cookies[ACCESS_TOKEN_COOKIE];
  }
  return null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        cookieExtractor,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'your-secret-key',
    });
  }

  async validate(payload: any) {
    return this.usersService.findById(payload.sub);
  }
}