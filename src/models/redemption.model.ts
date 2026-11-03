import type { Db } from '../lib/prisma.js';
import type { ReviewStatus } from '../generated/prisma/client.js';

const withPeople = {
  customer: { select: { id: true, name: true, phone: true } },
  resolvedBy: { select: { id: true, name: true } },
} as const;

export const RedemptionModel = {
  create: (db: Db, data: { customerId: string; rewardId: string; rewardName: string; rewardIcon: string; points: number }) =>
    db.redemptionRequest.create({ data, include: withPeople }),

  findById: (db: Db, id: string) => db.redemptionRequest.findUnique({ where: { id }, include: withPeople }),

  listForCustomer: (db: Db, customerId: string) =>
    db.redemptionRequest.findMany({ where: { customerId }, include: withPeople, orderBy: { requestedAt: 'desc' } }),

  list: (db: Db, status: ReviewStatus | undefined, skip: number, take: number) =>
    db.redemptionRequest.findMany({
      where: status ? { status } : {},
      include: withPeople,
      orderBy: { requestedAt: 'desc' },
      skip,
      take,
    }),

  count: (db: Db, status?: ReviewStatus) => db.redemptionRequest.count({ where: status ? { status } : {} }),

  /** Points already promised to this customer's pending requests. */
  pendingPoints: async (db: Db, customerId: string) => {
    const sum = await db.redemptionRequest.aggregate({
      where: { customerId, status: 'PENDING' },
      _sum: { points: true },
    });
    return sum._sum.points ?? 0;
  },

  hasPending: async (db: Db, customerId: string, rewardId: string) =>
    (await db.redemptionRequest.count({ where: { customerId, rewardId, status: 'PENDING' } })) > 0,

  /** Moves a request out of PENDING exactly once. Returns false if someone else resolved it first. */
  resolvePending: async (
    db: Db,
    id: string,
    status: 'APPROVED' | 'REJECTED',
    resolvedById: string,
  ) => {
    const result = await db.redemptionRequest.updateMany({
      where: { id, status: 'PENDING' },
      data: { status, resolvedAt: new Date(), resolvedById },
    });
    return result.count === 1;
  },

  countIssued: (db: Db, since: Date) =>
    db.redemptionRequest.count({ where: { status: 'APPROVED', resolvedAt: { gte: since } } }),

  /** Approved requests resolved on/after `since` (or all time when null), newest first. */
  listIssued: (db: Db, since: Date | null, until: Date | null = null) =>
    db.redemptionRequest.findMany({
      where: {
        status: 'APPROVED',
        ...(since || until ? { resolvedAt: { ...(since ? { gte: since } : {}), ...(until ? { lte: until } : {}) } } : {}),
      },
      include: withPeople,
      orderBy: { resolvedAt: 'desc' },
    }),
};
