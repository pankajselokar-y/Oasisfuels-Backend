import type { Db } from '../lib/prisma.js';
import type { TransactionSource, TransactionType } from '../generated/prisma/client.js';

export interface NewTransaction {
  customerId: string;
  type: TransactionType;
  source: TransactionSource;
  label: string;
  amount: number;
  fuelAmountRupees?: number | null;
  performedById?: string | null;
}

const withStaff = { performedBy: { select: { id: true, name: true } } } as const;

export const TransactionModel = {
  create: (db: Db, data: NewTransaction) => db.pointTransaction.create({ data, include: withStaff }),

  listForCustomer: (db: Db, customerId: string, skip: number, take: number) =>
    db.pointTransaction.findMany({
      where: { customerId },
      include: withStaff,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),

  countForCustomer: (db: Db, customerId: string) => db.pointTransaction.count({ where: { customerId } }),

  redeemedCountFor: (db: Db, customerId: string) =>
    db.pointTransaction.count({ where: { customerId, type: 'REDEEM' } }),

  totalRedeemed: async (db: Db) => {
    const sum = await db.pointTransaction.aggregate({ where: { type: 'REDEEM' }, _sum: { amount: true } });
    return sum._sum.amount ?? 0;
  },
};
