import { NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';

// P2025 — Prisma не нашла запись, на которую нацелена операция
// (update/delete по несуществующему id).
export function isNotFoundError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2025'
  );
}

export function throwIfMissing(error: unknown, message: string): never {
  if (isNotFoundError(error)) {
    throw new NotFoundException(message);
  }
  throw error;
}
