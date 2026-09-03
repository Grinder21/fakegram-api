import { NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';

export function throwIfMissing(error: unknown, message: string): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2025'
  ) {
    throw new NotFoundException(message);
  }
  throw error;
}
