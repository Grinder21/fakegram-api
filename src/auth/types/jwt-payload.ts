import type { Request } from 'express';

export interface JwtPayload {
  sub: string;
  username: string;
}

export type AuthenticatedRequest = Request & { user: JwtPayload };
