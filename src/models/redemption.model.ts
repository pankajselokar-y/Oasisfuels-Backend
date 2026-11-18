import type { Db } from '../lib/prisma.js';
import type { ReviewStatus } from '../generated/prisma/client.js';

const withPeople = {
  customer: { select: { id: true, name: true, phone: true } },
  resolvedBy: { select: { id: true, name: true } },
} as const;

export interface Handover {
  photo: Buffer;
  mime: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
}

export const RedemptionModel = {
  create: (
    db: Db,
    data: { customerId: string; rewardId: string; rewardName: string; rewardIcon: string; points: number; pointsDeductedAt: Date },
  ) => db.redemptionRequest.create({ data, include: withPeople }),

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

  /**
   * Points still promised to pending requests that were made before points were taken up front. Newer requests have already
   * been paid for, so they hold nothing extra.
   */
  legacyHeldPoints: async (db: Db, customerId: string) => {
    const sum = await db.redemptionRequest.aggregate({
      where: { customerId, status: 'PENDING', pointsDeductedAt: null },
      _sum: { points: true },
    });
    return sum._sum.points ?? 0;
  },

  /** Gifts actually handed over to this customer. */
  issuedCountFor: (db: Db, customerId: string) => db.redemptionRequest.count({ where: { customerId, status: 'APPROVED' } }),

  /** The points that left as handed-over gifts, across all customers. */
  issuedPointsTotal: async (db: Db) => {
    const sum = await db.redemptionRequest.aggregate({ where: { status: 'APPROVED' }, _sum: { points: true } });
    return sum._sum.points ?? 0;
  },

  hasPending: async (db: Db, customerId: string, rewardId: string) =>
    (await db.redemptionRequest.count({ where: { customerId, rewardId, status: 'PENDING' } })) > 0,

  /**
   * Moves a request out of PENDING exactly once. Returns false if someone else resolved it first.
   * `APPROVED` means the gift was handed over (with its photo); `REJECTED` means cancelled by the customer or rejected by staff.
   */
  resolvePending: async (
    db: Db,
    id: string,
    change: {
      status: 'APPROVED' | 'REJECTED';
      resolvedById: string | null;
      rejectionReason?: string | null;
      cancelledByCustomer?: boolean;
      handover?: Handover;
    },
  ) => {
    const result = await db.redemptionRequest.updateMany({
      where: { id, status: 'PENDING' },
      data: {
        status: change.status,
        resolvedAt: new Date(),
        resolvedById: change.resolvedById,
        rejectionReason: change.rejectionReason ?? null,
        cancelledByCustomer: change.cancelledByCustomer ?? false,
        ...(change.handover
          ? {
              handoverPhoto: new Uint8Array(change.handover.photo),
              handoverPhotoMime: change.handover.mime,
              handoverLatitude: change.handover.latitude,
              handoverLongitude: change.handover.longitude,
              handoverAccuracy: change.handover.accuracy,
            }
          : {}),
      },
    });
    return result.count === 1;
  },

  markRefunded: (db: Db, id: string) => db.redemptionRequest.update({ where: { id }, data: { refundedAt: new Date() } }),

  /** For a request made before points were taken up front: they are taken when the gift is handed over. */
  markDeducted: (db: Db, id: string) => db.redemptionRequest.update({ where: { id }, data: { pointsDeductedAt: new Date() } }),

  /** The handover photo and its type: the one query that asks for the image bytes. */
  findPhoto: (db: Db, id: string) =>
    db.redemptionRequest.findUnique({ where: { id }, select: { customerId: true, handoverPhoto: true, handoverPhotoMime: true } }),

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
