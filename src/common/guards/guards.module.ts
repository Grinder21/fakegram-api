import { Module } from '@nestjs/common';
import { JwtGuard } from './jwt.guard';
import { JwtModule } from '@nestjs/jwt';
import { jwtConfig } from '../jwt.config';

@Module({
  providers: [JwtGuard],
  exports: [JwtGuard],
  imports: [JwtModule.registerAsync(jwtConfig)],
})
export class GuardsModule {}
