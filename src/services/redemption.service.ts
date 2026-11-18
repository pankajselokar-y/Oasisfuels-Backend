import { ALLOWED_PHOTO_TYPES } from '../config/constants.js';
import { logger } from '../lib/logger.js';
import { stampJpeg } from '../lib/photoStamp.js';
import { prisma } from '../lib/prisma.js';
import { detectImageType } from '../lib/storage.js';
import type { ReviewStatus } from '../generated/prisma/client.js';
import type { Role } from '../lib/jwt.js';
import { CustomerModel } from '../models/customer.model.js';
import { RedemptionModel } from '../models/redemption.model.js';
import { RewardModel } from '../models/reward.model.js';
import { badRequest, conflict, forbidden, notFound } from '../utils/AppError.js';
import { isUniqueViolation } from '../utils/prismaErrors.js';
import { toSkipTake, type Pagination } from '../utils/pagination.js';
import { debitPoints, refundPoints } from './points.service.js';

const log = logger('redemption');

const ALREADY_PENDING = 'You already have a pending request for this reward.';
const ALREADY_RESOLVED = 'This request has already been resolved.';
const NOT_ENOUGH = 'Not enough available points for this reward.';

export interface HandoverInput {
  photo: Buffer;
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export const RedemptionService = {
  /**
   * A customer asks for a gift. The points leave their balance right away (so they cannot be spent twice) and come back if
   * the request is cancelled or rejected. The gift itself is handed over later at the pump, by a staff member, with a photo.
   */
  async request(customerId: string, rewardId: string) {
    const reward = await RewardModel.findById(prisma, rewardId);
    if (!reward || !reward.active) throw notFound('Reward not found.');

    try {
      return await prisma.$transaction(async (tx) => {
        const customer = await CustomerModel.findById(tx, customerId);
        if (!customer) throw notFound('Customer not found.');
        if (await RedemptionModel.hasPending(tx, customerId, rewardId)) throw conflict(ALREADY_PENDING);

        // Requests made before points were taken up front still hold their points until hand-over.
        const held = await RedemptionModel.legacyHeldPoints(tx, customerId);
        if (customer.points - held < reward.points) throw badRequest(NOT_ENOUGH);

        // The debit is conditional on the balance, so two requests at once cannot overdraw it.
        try {
          await debitPoints(tx, { customerId, points: reward.points, label: reward.name, source: 'REDEMPTION' });
        } catch {
          throw badRequest(NOT_ENOUGH);
        }
        return RedemptionModel.create(tx, {
          customerId,
          rewardId: reward.id,
          rewardName: reward.name,
          rewardIcon: reward.icon,
          points: reward.points,
          pointsDeductedAt: new Date(),
        });
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw conflict(ALREADY_PENDING);
      throw error;
    }
  },

  listForCustomer: (customerId: string) => RedemptionModel.listForCustomer(prisma, customerId),

  async list(status: ReviewStatus | undefined, pagination: Pagination) {
    const { skip, take } = toSkipTake(pagination);
    const [requests, total] = await Promise.all([
      RedemptionModel.list(prisma, status, skip, take),
      RedemptionModel.count(prisma, status),
    ]);
    return { requests, total };
  },

  async getForViewer(id: string, viewer: { id: string; role: Role }) {
    const request = await RedemptionModel.findById(prisma, id);
    if (!request) throw notFound('Redemption request not found.');
    if (viewer.role === 'CUSTOMER' && request.customerId !== viewer.id) throw forbidden();
    return request;
  },

  /** The handover photo for a request the viewer may see, or null when there is none. */
  async photoFor(id: string, viewer: { id: string; role: Role }) {
    await this.getForViewer(id, viewer); // not found / not yours
    const stored = await RedemptionModel.findPhoto(prisma, id);
    if (!stored?.handoverPhoto || !stored.handoverPhotoMime) return null;
    return { image: Buffer.from(stored.handoverPhoto), mime: stored.handoverPhotoMime };
  },

  /**
   * Staff hand the gift over: the photo (with the time and place it was taken) is attached to the request and the request
   * closes. A request made before points were taken up front pays its points now instead.
   */
  async issue(id: string, staffId: string, handover: HandoverInput) {
    const mime = detectImageType(handover.photo);
    if (!mime || !(ALLOWED_PHOTO_TYPES as readonly string[]).includes(mime)) {
      throw badRequest('The photo must be a JPEG, PNG or WebP image.');
    }
    // Stamped with the date, time and place, like a fuel proof. A photo that cannot be stamped is kept as it was.
    let photo = handover.photo;
    if (mime === 'image/jpeg') {
      try {
        photo = stampJpeg(
          photo,
          { latitude: handover.latitude, longitude: handover.longitude, accuracy: handover.accuracy, at: new Date() },
          'GIFT HANDOVER',
        );
      } catch (error) {
        log.warn(`could not stamp the handover photo, keeping the original: ${error instanceof Error ? error.message : error}`);
      }
    }

    await prisma.$transaction(async (tx) => {
      const request = await RedemptionModel.findById(tx, id);
      if (!request) throw notFound('Redemption request not found.');
      if (request.status !== 'PENDING') throw conflict(ALREADY_RESOLVED);

      const resolved = await RedemptionModel.resolvePending(tx, id, {
        status: 'APPROVED',
        resolvedById: staffId,
        handover: { photo, mime, latitude: handover.latitude, longitude: handover.longitude, accuracy: handover.accuracy ?? null },
      });
      if (!resolved) throw conflict(ALREADY_RESOLVED);

      if (!request.pointsDeductedAt) {
        await debitPoints(tx, {
          customerId: request.customerId,
          points: request.points,
          label: request.rewardName,
          source: 'REDEMPTION',
          staffId,
        });
        await RedemptionModel.markDeducted(tx, id);
      }
    });
    return RedemptionModel.findById(prisma, id);
  },

  /** The customer withdraws their own pending request; the points come back. */
  async cancel(id: string, customerId: string) {
    const request = await RedemptionModel.findById(prisma, id);
    if (!request) throw notFound('Redemption request not found.');
    if (request.customerId !== customerId) throw forbidden();
    return this.close(id, { staffId: null, reason: null, byCustomer: true });
  },

  /** Staff turn a request down; the points come back. */
  reject(id: string, staffId: string, reason?: string) {
    return this.close(id, { staffId, reason: reason?.trim() || null, byCustomer: false });
  },

  /** Closes a pending request as cancelled/rejected and returns its points, exactly once. */
  async close(id: string, who: { staffId: string | null; reason: string | null; byCustomer: boolean }) {
    await prisma.$transaction(async (tx) => {
      const request = await RedemptionModel.findById(tx, id);
      if (!request) throw notFound('Redemption request not found.');
      if (request.status !== 'PENDING') throw conflict(ALREADY_RESOLVED);

      const resolved = await RedemptionModel.resolvePending(tx, id, {
        status: 'REJECTED',
        resolvedById: who.staffId,
        rejectionReason: who.reason,
        cancelledByCustomer: who.byCustomer,
      });
      if (!resolved) throw conflict(ALREADY_RESOLVED);

      // Only a request whose points were actually taken has anything to give back.
      if (request.pointsDeductedAt) {
        await refundPoints(tx, {
          customerId: request.customerId,
          points: request.points,
          label: `Refund: ${request.rewardName}`,
          ...(who.staffId ? { staffId: who.staffId } : {}),
        });
        await RedemptionModel.markRefunded(tx, id);
      }
    });
    return RedemptionModel.findById(prisma, id);
  },
};
