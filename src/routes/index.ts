import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { reportRoutes, rewardRoutes, settingRoutes, staffRoutes } from './admin.routes.js';
import { authRoutes } from './auth.routes.js';
import { customerRoutes } from './customer.routes.js';
import { fuelClaimRoutes } from './fuelClaim.routes.js';
import { fuelEntryRoutes } from './fuelEntry.routes.js';
import { meRoutes } from './me.routes.js';
import { redemptionRoutes } from './redemption.routes.js';

export const apiRouter = Router();

apiRouter.get('/health', async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ data: { status: 'ok', database: 'up' } });
});

apiRouter.use('/auth', authRoutes);
apiRouter.use('/me', meRoutes);
apiRouter.use('/customers', customerRoutes);
apiRouter.use('/rewards', rewardRoutes);
apiRouter.use('/fuel-entries', fuelEntryRoutes);
apiRouter.use('/fuel-claims', fuelClaimRoutes);
apiRouter.use('/redemption-requests', redemptionRoutes);
apiRouter.use('/staff', staffRoutes);
apiRouter.use('/reports', reportRoutes);
apiRouter.use('/settings', settingRoutes);
