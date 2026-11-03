import { PrismaPg } from '@prisma/adapter-pg';
import { env } from '../config/env.js';
import { Prisma, PrismaClient } from '../generated/prisma/client.js';

// Serverless instances each hold their own pool, so keep it small there or many instances exhaust the database's connections.
const adapter = new PrismaPg({ connectionString: env.DATABASE_URL, max: process.env['VERCEL'] ? 3 : 10 });

// Prisma's default transaction limit is 5 s. Several of ours do a dozen queries (sign-up with a referral, approvals), and when
// the database is in another region each query costs a few hundred ms, so allow far more headroom than the default.
export const prisma = new PrismaClient({ adapter, transactionOptions: { maxWait: 10_000, timeout: 30_000 } });

/** Either the shared client or the client handed to a `$transaction` callback. */
export type Db = PrismaClient | Prisma.TransactionClient;
