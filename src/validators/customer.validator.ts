import { z } from 'zod';
import { paginationQuery } from '../utils/pagination.js';
import { name, phone, pin, vehicleInput } from './common.js';

export const listCustomersQuery = paginationQuery.extend({ search: z.string().trim().optional() });

/** A cashier/admin registering a walk-in customer. The PIN is optional; the default PIN applies otherwise. */
export const createCustomerBody = z.object({
  name,
  phone,
  pin: pin.optional(),
  vehicle: vehicleInput.optional(),
  referralCode: z.string().trim().optional(),
});

export const updateProfileBody = z.object({ name });

export const changePinBody = z.object({ currentPin: z.string().min(1), newPin: pin });

export const historyQuery = paginationQuery;

export const vehicleIdParams = z.object({ vehicleId: z.uuid('Invalid id.') });

export const vehicleBody = vehicleInput;
