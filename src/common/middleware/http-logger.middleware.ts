import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../types/jwt-payload';

@Injectable()
export class HttpLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
    const start = performance.now();

    res.on('finish', () => {
      const ms = Math.round(performance.now() - start);
      const userId = req.user?.sub ?? 'anonymous';
      const message = `${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms user=${userId}`;

      if (res.statusCode >= 500) {
        this.logger.error(message);
      } else if (res.statusCode >= 400) {
        this.logger.warn(message);
      } else {
        this.logger.log(message);
      }
    });

    next();
  }
}
