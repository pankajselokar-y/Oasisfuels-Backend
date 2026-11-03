import type { RequestHandler } from 'express';
import { FuelEntryService } from '../services/fuelEntry.service.js';
import { authOf, created } from '../utils/http.js';
import { decodePhotoDataUri } from '../utils/photo.js';
import { customerDto, fuelClaimDto, rewardDto, transactionDto } from '../utils/serializers.js';

export const record: RequestHandler = async (req, res) => {
  const { proof, ...entry } = req.body;
  const result = await FuelEntryService.record({
    ...entry,
    staffId: authOf(req).sub,
    proof: proof ? { ...proof, photo: decodePhotoDataUri(proof.photoDataUri) } : undefined,
  });
  created(res, {
    customer: customerDto(result.customer),
    transaction: transactionDto(result.transaction),
    amountRupees: result.amountRupees,
    litres: result.litres,
    pointsEarned: result.pointsEarned,
    unlockedRewards: result.unlockedRewards.map(rewardDto),
    proof: result.proof ? fuelClaimDto(result.proof) : null,
  });
};
