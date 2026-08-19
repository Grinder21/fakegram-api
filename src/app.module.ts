import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AlbumsModule } from './albums/albums.module';
import { PhotosModule } from './photos/photos.module';
import { CommentsModule } from './comments/comments.module';
import { ConfigModule } from '@nestjs/config';
import { GuardsModule } from './common/guards/guards.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    GuardsModule,
    AuthModule,
    UsersModule,
    AlbumsModule,
    PhotosModule,
    CommentsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
