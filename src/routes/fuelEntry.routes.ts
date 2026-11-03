import { Router } from 'express';
import * as fuelEntries from '../controllers/fuelEntry.controller.js';
import { authenticate, cashierOnly } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { fuelEntryBody } from '../validators/operations.validator.js';

/** Recording fuel at the counter is a cashier-only job — admins cannot enter fuel. */
export const fuelEntryRoutes = Router();

fuelEntryRoutes.post('/', authenticate, cashierOnly, validate({ body: fuelEntryBody }), fuelEntries.record);
