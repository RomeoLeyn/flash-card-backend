import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { Request, Response } from 'express';

type AuthenticatedRequest = Request & {
  user?: {
    id?: string;
  };
};

type RateLimitWindow = {
  count: number;
  resetAt: number;
};

@Injectable()
export class AiExplainRateLimitGuard implements CanActivate {
  private readonly limit = 10;
  private readonly windowMs = 60_000;
  private readonly windows = new Map<string, RateLimitWindow>();

  canActivate(context: ExecutionContext): boolean {
    const http = context.switchToHttp();
    const request = http.getRequest<AuthenticatedRequest>();
    const response = http.getResponse<Response>();
    const userId = request.user?.id;

    if (!userId) {
      throw new HttpException(
        'Authentication is required.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const now = Date.now();
    let window = this.windows.get(userId);

    if (!window || now >= window.resetAt) {
      window = { count: 0, resetAt: now + this.windowMs };
      this.windows.set(userId, window);
    }

    if (window.count >= this.limit) {
      response.setHeader(
        'Retry-After',
        Math.ceil((window.resetAt - now) / 1000),
      );
      throw new HttpException(
        'Too many word explanation requests. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    window.count += 1;

    if (this.windows.size > 1000) {
      for (const [id, entry] of this.windows) {
        if (now >= entry.resetAt) this.windows.delete(id);
      }
    }

    return true;
  }
}
