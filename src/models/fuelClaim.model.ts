import type { Db } from '../lib/prisma.js';
import type { ReviewStatus } from '../generated/prisma/client.js';

const withPeople = {
  customer: { select: { id: true, name: true, phone: true } },
  resolvedBy: { select: { id: true, name: true } },
} as const;

/** A proof the cashier captured while recording the fill-up, so it is stored already approved. */
export interface NewVerifiedFuelClaim {
  id: string;
  customerId: string;
  /** Null when the cashier typed a plate that is not on the customer's profile. */
  vehicleId: string | null;
  vehicleModel: string;
  vehicleNumber: string;
  claimedAmountRupees: number;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  /** The photo bytes; they are stored in the database. */
  photo: Buffer;
  photoMime: string;
  resolvedById: string;
  pointsAwarded: number;
}

export const FuelClaimModel = {
  /** A recent fill-up (not rejected) of the same customer, vehicle and amount: the sign of an accidental repeat. */
  findRecentSame: (db: Db, q: { customerId: string; vehicleNumber: string; amountRupees: number; since: Date }) =>
    db.fuelClaim.findFirst({
      where: {
        customerId: q.customerId,
        vehicleNumber: q.vehicleNumber,
        claimedAmountRupees: q.amountRupees,
        status: { in: ['PENDING', 'APPROVED'] },
        submittedAt: { gte: q.since },
      },
      orderBy: { submittedAt: 'desc' },
      select: { id: true, submittedAt: true },
    }),

  createVerified: (db: Db, { photo, ...data }: NewVerifiedFuelClaim) =>
    db.fuelClaim.create({
      data: {
        ...data,
        photoData: new Uint8Array(photo),
        status: 'APPROVED',
        resolvedAt: new Date(),
        approvedAmountRupees: data.claimedAmountRupees,
      },
      include: withPeople,
    }),

  /** The stored photo and where it lives. This is the one query that asks for the image bytes. */
  findPhoto: (db: Db, id: string) =>
    db.fuelClaim.findUnique({ where: { id }, select: { photoData: true, photoPath: true, photoMime: true } }),

  findById: (db: Db, id: string) => db.fuelClaim.findUnique({ where: { id }, include: withPeople }),

  listForCustomer: (db: Db, customerId: string) =>
    db.fuelClaim.findMany({ where: { customerId }, include: withPeople, orderBy: { submittedAt: 'desc' } }),

  list: (db: Db, status: ReviewStatus | undefined, skip: number, take: number) =>
    db.fuelClaim.findMany({
      where: status ? { status } : {},
      include: withPeople,
      orderBy: { submittedAt: 'desc' },
      skip,
      take,
    }),

  count: (db: Db, status?: ReviewStatus) => db.fuelClaim.count({ where: status ? { status } : {} }),

  /** Moves a claim out of PENDING exactly once. Returns false if someone else resolved it first. */
  resolvePending: async (
    db: Db,
    id: string,
    data: {
      status: 'APPROVED' | 'REJECTED';
      resolvedById: string;
      approvedAmountRupees?: number;
      pointsAwarded?: number;
      rejectionReason?: string | null;
    },
  ) => {
    const result = await db.fuelClaim.updateMany({
      where: { id, status: 'PENDING' },
      data: { ...data, resolvedAt: new Date() },
    });
    return result.count === 1;
  },
};
