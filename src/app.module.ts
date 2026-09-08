import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AlbumsModule } from './albums/albums.module';
import { PhotosModule } from './photos/photos.module';
import { CommentsModule } from './comments/comments.module';
import { ConfigModule } from '@nestjs/config';
import { GuardsModule } from './common/guards/guards.module';
import { HealthModule } from './health/health.module';

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
  ],
})
export class AppModule {}
