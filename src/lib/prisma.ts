import { PrismaPg } from '@prisma/adapter-pg';
import { env } from '../config/env.js';
import { Prisma, PrismaClient } from '../generated/prisma/client.js';

const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

export const prisma = new PrismaClient({ adapter });

/** Either the shared client or the client handed to a `$transaction` callback. */
export type Db = PrismaClient | Prisma.TransactionClient;
