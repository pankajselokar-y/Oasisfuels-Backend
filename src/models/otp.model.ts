import type { Db } from '../lib/prisma.js';
import type { OtpPurpose } from '../generated/prisma/client.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export const OtpModel = {
  create: (db: Db, data: { phone: string; purpose: OtpPurpose; codeHash: string; expiresAt: Date }) =>
    db.otpCode.create({ data }),

  /** The newest code that can still be used: not consumed and not expired. */
  findActive: (db: Db, phone: string, purpose: OtpPurpose) =>
    db.otpCode.findFirst({
      where: { phone, purpose, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    }),

  latestCreatedAt: async (db: Db, phone: string, purpose: OtpPurpose) =>
    (await db.otpCode.findFirst({ where: { phone, purpose }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }))
      ?.createdAt ?? null,

  countSince: (db: Db, phone: string, purpose: OtpPurpose, since: Date) =>
    db.otpCode.count({ where: { phone, purpose, createdAt: { gte: since } } }),

  /** A newly sent code replaces any earlier one that is still live. */
  invalidateActive: (db: Db, phone: string, purpose: OtpPurpose) =>
    db.otpCode.updateMany({ where: { phone, purpose, consumedAt: null }, data: { consumedAt: new Date() } }),

  addFailedAttempt: (db: Db, id: string) => db.otpCode.update({ where: { id }, data: { attempts: { increment: 1 } } }),

  /** Marks a code used exactly once. Returns false if it was already used or has expired meanwhile. */
  consume: async (db: Db, id: string) => {
    const result = await db.otpCode.updateMany({
      where: { id, consumedAt: null, expiresAt: { gt: new Date() } },
      data: { consumedAt: new Date() },
    });
    return result.count === 1;
  },

  remove: (db: Db, id: string) => db.otpCode.delete({ where: { id } }),

  purgeOlderThanOneDay: (db: Db) => db.otpCode.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - DAY_MS) } } }),
};
