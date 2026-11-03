import { z } from 'zod';

export const phone = z.string().trim().regex(/^\d{10}$/, 'Enter a valid 10-digit mobile number.');
export const pin = z.string().regex(/^\d{4}$/, 'PIN must be exactly 4 digits.');
export const name = z.string().trim().min(1, 'Name is required.').max(100);
export const username = z
  .string()
  .trim()
  .regex(/^[a-z0-9._]{3,20}$/i, 'Username must be 3-20 characters: letters, numbers, dot or underscore.');
export const staffPassword = z.string().min(6, 'Password must be at least 6 characters.').max(100);

export const idParam = z.object({ id: z.uuid('Invalid id.') });

export const reviewStatus = z.enum(['PENDING', 'APPROVED', 'REJECTED']);

export const vehicleInput = z.object({
  number: z.string().trim().min(1, 'Vehicle number is required.'),
  model: z.string().trim().max(60).optional(),
});
