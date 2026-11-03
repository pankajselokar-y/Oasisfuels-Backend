import { randomUUID } from 'node:crypto';
import { ALLOWED_PHOTO_TYPES } from '../config/constants.js';
import { prisma } from '../lib/prisma.js';
import { detectImageType, removeUpload, saveFuelPhoto, uploadPath } from '../lib/storage.js';
import type { ReviewStatus } from '../generated/prisma/client.js';
import { FuelClaimModel } from '../models/fuelClaim.model.js';
import { SettingModel } from '../models/setting.model.js';
import { VehicleModel } from '../models/vehicle.model.js';
import { badRequest, conflict, forbidden, notFound } from '../utils/AppError.js';
import { pointsForAmount } from '../utils/fuel.js';
import { isUniqueViolation } from '../utils/prismaErrors.js';
import { toSkipTake, type Pagination } from '../utils/pagination.js';
import type { Role } from '../lib/jwt.js';
import { creditPoints } from './points.service.js';

const PENDING_EXISTS = 'You already have a fuel upload awaiting approval. Please wait for the cashier to review it.';

export interface ClaimSubmission {
  customerId: string;
  vehicleId: string;
  amountRupees: number;
  latitude: number;
  longitude: number;
  accuracy?: number;
  photo?: { buffer: Buffer };
}

export const FuelClaimService = {
  /** A customer's "I just fuelled" proof: vehicle, amount, dashboard photo and GPS, all required. */
  async submit(input: ClaimSubmission) {
    if (!input.photo) throw badRequest('A dashboard photo is required.');
    const mime = detectImageType(input.photo.buffer);
    if (!mime || !(ALLOWED_PHOTO_TYPES as readonly string[]).includes(mime)) {
      throw badRequest('The photo must be a JPEG, PNG or WebP image.');
    }

    const settings = await SettingModel.get(prisma);
    pointsForAmount(settings, input.amountRupees); // rejects amounts below the minimum

    const vehicle = await VehicleModel.findOwned(prisma, input.customerId, input.vehicleId);
    if (!vehicle) throw badRequest('Select the vehicle you fuelled.');
    if (await FuelClaimModel.hasPending(prisma, input.customerId)) throw conflict(PENDING_EXISTS);

    const id = randomUUID();
    const photoPath = await saveFuelPhoto(id, input.photo.buffer, mime);
    try {
      return await FuelClaimModel.create(prisma, {
        id,
        customerId: input.customerId,
        vehicleId: vehicle.id,
        vehicleModel: vehicle.model,
        vehicleNumber: vehicle.number,
        claimedAmountRupees: input.amountRupees,
        latitude: input.latitude,
        longitude: input.longitude,
        accuracy: input.accuracy ?? null,
        photoPath,
        photoMime: mime,
      });
    } catch (error) {
      await removeUpload(photoPath);
      if (isUniqueViolation(error)) throw conflict(PENDING_EXISTS);
      throw error;
    }
  },

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
