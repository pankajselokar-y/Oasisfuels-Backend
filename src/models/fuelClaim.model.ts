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
  photoPath: string;
  photoMime: string;
  resolvedById: string;
  pointsAwarded: number;
}

export const FuelClaimModel = {
  createVerified: (db: Db, data: NewVerifiedFuelClaim) =>
    db.fuelClaim.create({
      data: { ...data, status: 'APPROVED', resolvedAt: new Date(), approvedAmountRupees: data.claimedAmountRupees },
      include: withPeople,
    }),

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
