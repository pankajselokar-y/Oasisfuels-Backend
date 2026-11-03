import type { RequestHandler } from 'express';
import { FuelEntryService } from '../services/fuelEntry.service.js';
import { authOf, created } from '../utils/http.js';
import { customerDto, rewardDto, transactionDto } from '../utils/serializers.js';

export const record: RequestHandler = async (req, res) => {
  const result = await FuelEntryService.record({ ...req.body, staffId: authOf(req).sub });
  created(res, {
    customer: customerDto(result.customer),
    transaction: transactionDto(result.transaction),
    amountRupees: result.amountRupees,
    litres: result.litres,
    pointsEarned: result.pointsEarned,
    unlockedRewards: result.unlockedRewards.map(rewardDto),
  });
};
