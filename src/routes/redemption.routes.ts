import { Router } from 'express';
import * as redemptions from '../controllers/redemption.controller.js';
import { authenticate, customerOnly, staffOnly } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { idParam } from '../validators/common.js';
import { requestRedemptionBody, reviewListQuery } from '../validators/operations.validator.js';

export const redemptionRoutes = Router();

redemptionRoutes.use(authenticate);

redemptionRoutes.post('/', customerOnly, validate({ body: requestRedemptionBody }), redemptions.request);
redemptionRoutes.get('/mine', customerOnly, redemptions.mine);

redemptionRoutes.get('/', staffOnly, validate({ query: reviewListQuery }), redemptions.list);
redemptionRoutes.post('/:id/approve', staffOnly, validate({ params: idParam }), redemptions.approve);
redemptionRoutes.post('/:id/reject', staffOnly, validate({ params: idParam }), redemptions.reject);
