import { ValidationPipe, type INestApplication } from '@nestjs/common';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

export function configureApp(app: INestApplication): void {
  app.use(helmet({ xFrameOptions: { action: 'deny' } }));
  app.use(cookieParser());
  app.use(compression());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
}
