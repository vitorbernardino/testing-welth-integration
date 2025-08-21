import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

interface RateLimitData {
  count: number;
  resetTime: number;
}

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private requests = new Map<string, RateLimitData>();
  private readonly limit = 100; // 100 requests
  private readonly windowMs = 15 * 60 * 1000; // 15 minutes

  use(req: Request, res: Response, next: NextFunction) {
    const key = this.getKey(req);
    const now = Date.now();
    
    // Clean expired entries
    this.cleanup(now);

    const requestData = this.requests.get(key);

    if (!requestData) {
      this.requests.set(key, {
        count: 1,
        resetTime: now + this.windowMs,
      });
      return next();
    }

    if (now > requestData.resetTime) {
      // Reset window
      this.requests.set(key, {
        count: 1,
        resetTime: now + this.windowMs,
      });
      return next();
    }

    if (requestData.count >= this.limit) {
      res.status(429).json({
        success: false,
        message: 'Too many requests, please try again later.',
        retryAfter: Math.ceil((requestData.resetTime - now) / 1000),
        timestamp: new Date().toISOString(),
      });
      return;
    }

    requestData.count++;
    next();
  }

  private getKey(req: Request): string {
    // Use IP address as key, could be enhanced with user ID for authenticated requests
    return req.ip || req.connection.remoteAddress || 'unknown';
  }

  private cleanup(now: number) {
    for (const [key, data] of this.requests.entries()) {
      if (now > data.resetTime) {
        this.requests.delete(key);
      }
    }
  }
}