import { Router } from 'express';
import * as redemptions from '../controllers/redemption.controller.js';
import { authenticate, customerOnly, staffOnly } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { idParam } from '../validators/common.js';
import { issueRedemptionBody, rejectRedemptionBody, requestRedemptionBody, reviewListQuery } from '../validators/operations.validator.js';

export const redemptionRoutes = Router();

redemptionRoutes.use(authenticate);

redemptionRoutes.post('/', customerOnly, validate({ body: requestRedemptionBody }), redemptions.request);
redemptionRoutes.get('/mine', customerOnly, redemptions.mine);
redemptionRoutes.post('/:id/cancel', customerOnly, validate({ params: idParam }), redemptions.cancel);

redemptionRoutes.get('/', staffOnly, validate({ query: reviewListQuery }), redemptions.list);
redemptionRoutes.post('/:id/issue', staffOnly, validate({ params: idParam, body: issueRedemptionBody }), redemptions.issue);
redemptionRoutes.post('/:id/reject', staffOnly, validate({ params: idParam, body: rejectRedemptionBody }), redemptions.reject);

// The owner (customer) or any staff member can view the handover photo.
redemptionRoutes.get('/:id/photo', validate({ params: idParam }), redemptions.photo);
