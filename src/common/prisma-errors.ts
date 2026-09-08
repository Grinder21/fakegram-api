import { NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';

export function throwIfMissing(error: unknown, message: string): never {
  if (isNotFoundError(error)) {
    throw new NotFoundException(message);
  }
  throw error;
}

export function isNotFoundError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2025'
  );
}
