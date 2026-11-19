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

  /** A fuel entry of the same amount for this customer very recently (used when an entry has no vehicle to compare). */
  findRecentFuelEntry: (db: Db, customerId: string, amountRupees: number, since: Date) =>
    db.pointTransaction.findFirst({
      where: { customerId, source: 'FUEL_ENTRY', fuelAmountRupees: amountRupees, createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, createdAt: true },
    }),

  countForCustomer: (db: Db, customerId: string) => db.pointTransaction.count({ where: { customerId } }),
};
