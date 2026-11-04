import { z } from 'zod';
import { paginationQuery } from '../utils/pagination.js';
import { mobile, name, pin, vehicleInput } from './common.js';

export const listCustomersQuery = paginationQuery.extend({ search: z.string().trim().optional() });

/** A cashier/admin registering a walk-in customer. The PIN is optional; the default PIN applies otherwise. */
export const createCustomerBody = z.object({
  name,
  phone: mobile,
  pin: pin.optional(),
  vehicle: vehicleInput.optional(),
  referralCode: z.string().trim().optional(),
});

export const updateProfileBody = z.object({ name });

/** Staff set a new PIN for a customer who forgot theirs (there is no SMS reset while OTP is off). */
export const resetCustomerPinBody = z.object({ newPin: pin });

export const changePinBody = z.object({ currentPin: z.string().min(1), newPin: pin });

export const historyQuery = paginationQuery;

export const vehicleIdParams = z.object({ vehicleId: z.uuid('Invalid id.') });

export const vehicleBody = vehicleInput;
