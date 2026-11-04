import { z } from 'zod';

/** Looks an existing account up (log in, referral): any 10 digits, so older accounts can always sign in. */
export const phone = z.string().trim().regex(/^\d{10}$/, 'Enter a valid 10-digit mobile number.');
/** Creates an account: a real Indian mobile number, 10 digits starting with 6, 7, 8 or 9. */
export const mobile = z
  .string()
  .trim()
  .regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number (it must start with 6, 7, 8 or 9).');
export const pin = z.string().regex(/^\d{4}$/, 'PIN must be exactly 4 digits.');
export const name = z.string().trim().min(1, 'Name is required.').max(100);
export const username = z
  .string()
  .trim()
  .regex(/^[a-z0-9._]{3,20}$/i, 'Username must be 3-20 characters: letters, numbers, dot or underscore.')
  // The app's single login treats a 10-digit number as a customer's phone, so a username must not be all digits.
  .refine((value) => /\D/.test(value), 'Username cannot be only digits.');
export const staffPassword = z.string().min(6, 'Password must be at least 6 characters.').max(100);

export const idParam = z.object({ id: z.uuid('Invalid id.') });

export const reviewStatus = z.enum(['PENDING', 'APPROVED', 'REJECTED']);

export const vehicleInput = z.object({
  number: z.string().trim().min(1, 'Vehicle number is required.'),
  model: z.string().trim().max(60).optional(),
});
