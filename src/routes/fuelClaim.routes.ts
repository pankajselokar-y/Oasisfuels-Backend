import { Router } from 'express';
import * as claims from '../controllers/fuelClaim.controller.js';
import { authenticate, customerOnly, staffOnly } from '../middlewares/auth.js';
import { uploadPhoto } from '../middlewares/upload.js';
import { validate } from '../middlewares/validate.js';
import { idParam } from '../validators/common.js';
import {
  approveClaimBody,
  rejectClaimBody,
  reviewListQuery,
  submitClaimBody,
} from '../validators/operations.validator.js';

export const fuelClaimRoutes = Router();

fuelClaimRoutes.use(authenticate);

// Customers (multipart/form-data: vehicleId, amountRupees, latitude, longitude, accuracy?, photo)
fuelClaimRoutes.post('/', customerOnly, uploadPhoto, validate({ body: submitClaimBody }), claims.submit);
fuelClaimRoutes.get('/mine', customerOnly, claims.mine);

// Staff review queue
fuelClaimRoutes.get('/', staffOnly, validate({ query: reviewListQuery }), claims.list);
fuelClaimRoutes.post('/:id/approve', staffOnly, validate({ params: idParam, body: approveClaimBody }), claims.approve);
fuelClaimRoutes.post('/:id/reject', staffOnly, validate({ params: idParam, body: rejectClaimBody }), claims.reject);

// Staff, or the customer who submitted it
fuelClaimRoutes.get('/:id', validate({ params: idParam }), claims.get);
fuelClaimRoutes.get('/:id/photo', validate({ params: idParam }), claims.photo);
