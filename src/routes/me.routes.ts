import { Router } from 'express';
import * as me from '../controllers/me.controller.js';
import { authenticate, customerOnly } from '../middlewares/auth.js';
import { pinConfirmLimiter } from '../middlewares/rateLimit.js';
import { validate } from '../middlewares/validate.js';
import {
  changePinBody,
  deleteAccountBody,
  historyQuery,
  updateProfileBody,
  vehicleBody,
  vehicleIdParams,
} from '../validators/customer.validator.js';

/** The signed-in customer's own account. */
export const meRoutes = Router();

meRoutes.use(authenticate, customerOnly);

meRoutes.get('/', me.getProfile);
meRoutes.patch('/', validate({ body: updateProfileBody }), me.updateProfile);
meRoutes.patch('/pin', pinConfirmLimiter, validate({ body: changePinBody }), me.changePin);
meRoutes.delete('/', pinConfirmLimiter, validate({ body: deleteAccountBody }), me.deleteAccount);
meRoutes.get('/history', validate({ query: historyQuery }), me.history);

meRoutes.get('/vehicles', me.listVehicles);
meRoutes.post('/vehicles', validate({ body: vehicleBody }), me.addVehicle);
meRoutes.patch('/vehicles/:vehicleId', validate({ params: vehicleIdParams, body: vehicleBody }), me.updateVehicle);
meRoutes.delete('/vehicles/:vehicleId', validate({ params: vehicleIdParams }), me.removeVehicle);
