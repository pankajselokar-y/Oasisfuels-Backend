import { prisma } from '../lib/prisma.js';
import { RewardModel } from '../models/reward.model.js';

export const RewardService = {
  listActive: () => RewardModel.listActive(prisma),
};
