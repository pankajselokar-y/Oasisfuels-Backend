import { Router } from 'express';
import * as admin from '../controllers/admin.controller.js';
import { adminOnly, authenticate, staffOnly } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import {
  changeOwnPasswordBody,
  createStaffBody,
  issuedItemsQuery,
  setActiveBody,
  updateSettingsBody,
  updateStaffBody,
} from '../validators/admin.validator.js';
import { idParam } from '../validators/common.js';

export const staffRoutes = Router();
staffRoutes.use(authenticate);
// Must be declared before "/:id" so "me" is not read as an id.
staffRoutes.patch('/me/password', staffOnly, validate({ body: changeOwnPasswordBody }), admin.changeOwnPassword);
staffRoutes.get('/', adminOnly, admin.listStaff);
staffRoutes.post('/', adminOnly, validate({ body: createStaffBody }), admin.createStaff);
staffRoutes.patch('/:id', adminOnly, validate({ params: idParam, body: updateStaffBody }), admin.updateStaff);
staffRoutes.patch('/:id/active', adminOnly, validate({ params: idParam, body: setActiveBody }), admin.setStaffActive);

export const reportRoutes = Router();
reportRoutes.use(authenticate, adminOnly);
reportRoutes.get('/dashboard', admin.dashboard);
reportRoutes.get('/issued-items', validate({ query: issuedItemsQuery }), admin.issuedItems);

export const settingRoutes = Router();
// The program rules (rate, minimum, referral bonus) are not secret, and the sign-up screen shows them before login.
settingRoutes.get('/', admin.getSettings);
settingRoutes.patch('/', authenticate, adminOnly, validate({ body: updateSettingsBody }), admin.updateSettings);

export const rewardRoutes = Router();
rewardRoutes.get('/', authenticate, admin.listRewards);
