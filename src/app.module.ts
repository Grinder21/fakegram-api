import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AlbumsModule } from './albums/albums.module';
import { PhotosModule } from './photos/photos.module';
import { CommentsModule } from './comments/comments.module';
import { ConfigModule } from '@nestjs/config';
import { GuardsModule } from './common/guards/guards.module';
import { HealthModule } from './health/health.module';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    GuardsModule,
    AuthModule,
    UsersModule,
    AlbumsModule,
    PhotosModule,
    CommentsModule,
    HealthModule,
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60000,
          limit: 10,
        },
      ],
    }),
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
