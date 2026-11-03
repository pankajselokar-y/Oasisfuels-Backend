import { prisma } from '../lib/prisma.js';
import { uploadPath } from '../lib/storage.js';
import type { ReviewStatus } from '../generated/prisma/client.js';
import { FuelClaimModel } from '../models/fuelClaim.model.js';
import { SettingModel } from '../models/setting.model.js';
import { conflict, forbidden, notFound } from '../utils/AppError.js';
import { pointsForAmount } from '../utils/fuel.js';
import { toSkipTake, type Pagination } from '../utils/pagination.js';
import type { Role } from '../lib/jwt.js';
import { creditPoints } from './points.service.js';

export const FuelClaimService = {
  listForCustomer: (customerId: string) => FuelClaimModel.listForCustomer(prisma, customerId),

  async list(status: ReviewStatus | undefined, pagination: Pagination) {
    const { skip, take } = toSkipTake(pagination);
    const [claims, total] = await Promise.all([
      FuelClaimModel.list(prisma, status, skip, take),
      FuelClaimModel.count(prisma, status),
    ]);
    return { claims, total };
  },

  async getForViewer(id: string, viewer: { id: string; role: Role }) {
    const claim = await FuelClaimModel.findById(prisma, id);
    if (!claim) throw notFound('Fuel claim not found.');
    if (viewer.role === 'CUSTOMER' && claim.customerId !== viewer.id) throw forbidden();
    return claim;
  },

  async photoFor(id: string, viewer: { id: string; role: Role }) {
    const claim = await this.getForViewer(id, viewer);
    return { absolutePath: uploadPath(claim.photoPath), mime: claim.photoMime };
  },

  /** Staff approve with the amount they verified (defaults to what the customer claimed). */
  async approve(id: string, staffId: string, amountRupees?: number) {
    await prisma.$transaction(async (tx) => {
      const claim = await FuelClaimModel.findById(tx, id);
      if (!claim) throw notFound('Fuel claim not found.');
      if (claim.status !== 'PENDING') throw conflict('This claim has already been resolved.');

      const settings = await SettingModel.get(tx);
      const approvedAmount = amountRupees ?? claim.claimedAmountRupees;
      const points = pointsForAmount(settings, approvedAmount);

      const claimed = await FuelClaimModel.resolvePending(tx, id, {
        status: 'APPROVED',
        resolvedById: staffId,
        approvedAmountRupees: approvedAmount,
        pointsAwarded: points,
      });
      if (!claimed) throw conflict('This claim has already been resolved.');

      await creditPoints(tx, {
        customerId: claim.customerId,
        points,
        label: `Fuel purchase: ${points} ltr`,
        source: 'FUEL_CLAIM',
        fuelAmountRupees: approvedAmount,
        staffId,
      });
    });
    return FuelClaimModel.findById(prisma, id);
  },

  async reject(id: string, staffId: string, reason?: string) {
    const claim = await FuelClaimModel.findById(prisma, id);
    if (!claim) throw notFound('Fuel claim not found.');
    const resolved = await FuelClaimModel.resolvePending(prisma, id, {
      status: 'REJECTED',
      resolvedById: staffId,
      rejectionReason: reason?.trim() || null,
    });
    if (!resolved) throw conflict('This claim has already been resolved.');
    return FuelClaimModel.findById(prisma, id);
  },
};
