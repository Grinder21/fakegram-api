import { ConfigService } from '@nestjs/config';
import { JwtModuleAsyncOptions } from '@nestjs/jwt';
import type { StringValue } from 'ms';

export const jwtConfig: JwtModuleAsyncOptions = {
  global: true,
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    signOptions: {
      expiresIn: config.getOrThrow<string>('ACCESS_TOKEN_TTL') as StringValue,
    },
  }),
};
