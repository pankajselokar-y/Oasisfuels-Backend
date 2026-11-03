import type { Db } from '../lib/prisma.js';
import { Prisma } from '../generated/prisma/client.js';
import { compactVehicleNumber } from '../utils/vehicleNumber.js';

const withVehicles = { vehicles: { orderBy: { createdAt: 'asc' } } } satisfies Prisma.CustomerInclude;

export type CustomerWithVehicles = Prisma.CustomerGetPayload<{ include: typeof withVehicles }>;

export interface NewCustomer {
  phone: string;
  pinHash: string;
  name: string;
  referredById?: string | null;
  vehicle?: { model: string; number: string; numberKey: string } | null;
}

function searchWhere(search?: string): Prisma.CustomerWhereInput {
  const term = search?.trim();
  if (!term) return {};
  const plate = compactVehicleNumber(term);
  return {
    OR: [
      { name: { contains: term, mode: 'insensitive' } },
      { phone: { contains: term } },
      ...(plate ? [{ vehicles: { some: { numberKey: { contains: plate } } } }] : []),
    ],
  };
}

export const CustomerModel = {
  findById: (db: Db, id: string) => db.customer.findUnique({ where: { id }, include: withVehicles }),

  findByPhone: (db: Db, phone: string) => db.customer.findUnique({ where: { phone }, include: withVehicles }),

  search: (db: Db, search: string | undefined, skip: number, take: number) =>
    db.customer.findMany({ where: searchWhere(search), include: withVehicles, orderBy: { name: 'asc' }, skip, take }),

  count: (db: Db, search?: string) => db.customer.count({ where: searchWhere(search) }),

  create: (db: Db, data: NewCustomer) =>
    db.customer.create({
      data: {
        phone: data.phone,
        pinHash: data.pinHash,
        name: data.name,
        referredById: data.referredById ?? null,
        ...(data.vehicle ? { vehicles: { create: data.vehicle } } : {}),
      },
      include: withVehicles,
    }),

  update: (db: Db, id: string, data: Prisma.CustomerUpdateInput) =>
    db.customer.update({ where: { id }, data, include: withVehicles }),

  /** Adds points to both the spendable balance and the lifetime total. */
  credit: (db: Db, id: string, points: number) =>
    db.customer.update({
      where: { id },
      data: { points: { increment: points }, lifetimePoints: { increment: points } },
    }),

  /** Removes points only if the balance covers it. Returns false when it does not. */
  debit: async (db: Db, id: string, points: number) => {
    const result = await db.customer.updateMany({
      where: { id, points: { gte: points } },
      data: { points: { decrement: points } },
    });
    return result.count === 1;
  },

  totals: async (db: Db) => {
    const [count, sums] = await Promise.all([
      db.customer.count(),
      db.customer.aggregate({ _sum: { points: true, lifetimePoints: true } }),
    ]);
    return {
      totalCustomers: count,
      outstandingPoints: sums._sum.points ?? 0,
      lifetimePointsIssued: sums._sum.lifetimePoints ?? 0,
    };
  },
};
