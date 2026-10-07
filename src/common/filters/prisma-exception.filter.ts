import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ConflictException,
  HttpException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Prisma } from '../../generated/prisma/client';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  override catch(
    exception: Prisma.PrismaClientKnownRequestError,
    host: ArgumentsHost,
  ): void {
    const mapped = this.mapToHttpException(exception);

    if (!mapped) {
      this.logger.error(
        `Unhandled Prisma error ${exception.code} ${JSON.stringify(exception.meta)}`,
        exception.stack,
      );
      super.catch(new InternalServerErrorException(), host);
      return;
    }

    this.logger.warn(
      `Prisma ${exception.code} -> HTTP ${mapped.getStatus()} ${JSON.stringify(exception.meta)}`,
    );
    super.catch(mapped, host);
  }

  private mapToHttpException(
    exception: Prisma.PrismaClientKnownRequestError,
  ): HttpException | null {
    switch (exception.code) {
      case 'P2002':
        return new ConflictException('Resource already exists');
      case 'P2025':
        return new NotFoundException('Resource not found');
      case 'P2003':
        return new BadRequestException('Related resource does not exist');
      default:
        return null;
    }
  }
}
