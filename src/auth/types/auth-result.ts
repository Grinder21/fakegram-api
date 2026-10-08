import type { User } from '../../generated/prisma/client';

export type PublicUser = Omit<User, 'passwordHash'> & { passwordHash?: never };

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

export interface AuthResult extends TokenPair {
  user: PublicUser;
}
