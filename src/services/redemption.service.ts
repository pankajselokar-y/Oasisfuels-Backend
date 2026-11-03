import { prisma } from '../lib/prisma.js';
import type { ReviewStatus } from '../generated/prisma/client.js';
import { CustomerModel } from '../models/customer.model.js';
import { RedemptionModel } from '../models/redemption.model.js';
import { RewardModel } from '../models/reward.model.js';
import { badRequest, conflict, notFound } from '../utils/AppError.js';
import { isUniqueViolation } from '../utils/prismaErrors.js';
import { toSkipTake, type Pagination } from '../utils/pagination.js';
import { debitPoints } from './points.service.js';

const ALREADY_PENDING = 'You already have a pending request for this reward.';

export const RedemptionService = {
  /**
   * Customers request a reward; points are only deducted when staff approve. Points already promised
   * to other pending requests are not available to spend again.
   */
  async request(customerId: string, rewardId: string) {
    const reward = await RewardModel.findById(prisma, rewardId);
    if (!reward || !reward.active) throw notFound('Reward not found.');

    const customer = await CustomerModel.findById(prisma, customerId);
    if (!customer) throw notFound('Customer not found.');

    if (await RedemptionModel.hasPending(prisma, customerId, rewardId)) throw conflict(ALREADY_PENDING);

    const pending = await RedemptionModel.pendingPoints(prisma, customerId);
    if (customer.points - pending < reward.points) {
      throw badRequest('Not enough available points for this reward.');
    }

    try {
      return await RedemptionModel.create(prisma, {
        customerId,
        rewardId: reward.id,
        rewardName: reward.name,
        rewardIcon: reward.icon,
        points: reward.points,
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

  /** Approving hands the item over: the request closes and the points leave the balance, atomically. */
  async approve(id: string, staffId: string) {
    await prisma.$transaction(async (tx) => {
      const request = await RedemptionModel.findById(tx, id);
      if (!request) throw notFound('Redemption request not found.');
      if (request.status !== 'PENDING') throw conflict('This request has already been resolved.');

      if (!(await RedemptionModel.resolvePending(tx, id, 'APPROVED', staffId))) {
        throw conflict('This request has already been resolved.');
      }
      await debitPoints(tx, {
        customerId: request.customerId,
        points: request.points,
        label: request.rewardName,
        source: 'REDEMPTION',
        staffId,
      });
    });
    return RedemptionModel.findById(prisma, id);
  },

  async reject(id: string, staffId: string) {
    const request = await RedemptionModel.findById(prisma, id);
    if (!request) throw notFound('Redemption request not found.');
    if (!(await RedemptionModel.resolvePending(prisma, id, 'REJECTED', staffId))) {
      throw conflict('This request has already been resolved.');
    }
    return RedemptionModel.findById(prisma, id);
  },
};
