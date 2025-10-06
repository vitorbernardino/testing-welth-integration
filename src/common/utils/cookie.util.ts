import { Response } from 'express';
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  FIFTEEN_MINUTES_IN_MS,
  SEVEN_DAYS_IN_MS,
} from '../constants/auth.constants';

function buildCookieOptions(maxAge: number) {
  const isSecure = (process.env.COOKIE_SECURE || 'false').toLowerCase() === 'true';
  const sameSiteEnv = (process.env.COOKIE_SAME_SITE || 'lax').toLowerCase() as
    | 'lax'
    | 'strict'
    | 'none';
  const domain = process.env.COOKIE_DOMAIN || '.vercel.app';

  return {
    httpOnly: true as const,
    secure: isSecure,
    sameSite: sameSiteEnv,
    domain,
    path: '/',
    maxAge,
  };
}


export function setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
  res.cookie(ACCESS_TOKEN_COOKIE, accessToken, buildCookieOptions(FIFTEEN_MINUTES_IN_MS));
  res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, buildCookieOptions(SEVEN_DAYS_IN_MS));
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_TOKEN_COOKIE, { path: '/' });
  res.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/' });
}