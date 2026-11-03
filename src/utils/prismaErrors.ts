import { Prisma } from '../generated/prisma/client.js';

/** True for Prisma's "unique constraint failed" error (P2002). */
export function isUniqueViolation(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}
