import { z } from 'zod';
import { paginationQuery } from '../utils/pagination.js';
import { reviewStatus } from './common.js';

const rupees = z.coerce.number().int('Enter a whole number of rupees.').positive('Amount must be greater than zero.');

/** A cashier records a fill-up as either the rupees paid or the litres dispensed — exactly one. */
export const fuelEntryBody = z
  .object({
    customerId: z.uuid('Invalid customer id.'),
    amountRupees: rupees.optional(),
    litres: z.coerce.number().positive().optional(),
  })
  .refine((v) => (v.amountRupees === undefined) !== (v.litres === undefined), {
    message: 'Provide either amountRupees or litres.',
  });

/** multipart/form-data: every field arrives as a string, hence the coercion. */
export const submitClaimBody = z.object({
  vehicleId: z.uuid('Select the vehicle you fuelled.'),
  amountRupees: rupees,
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  accuracy: z.coerce.number().nonnegative().optional(),
  /** Alternative to a multipart `photo` file: the photo as a base64 data URI (what the mobile app sends). */
  photoDataUri: z
    .string()
    .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/, 'The photo must be a JPEG, PNG or WebP image.')
    .optional(),
});

export const approveClaimBody = z.object({ amountRupees: rupees.optional() });
export const rejectClaimBody = z.object({ reason: z.string().trim().max(300).optional() });

export const reviewListQuery = paginationQuery.extend({ status: reviewStatus.optional() });

export const requestRedemptionBody = z.object({ rewardId: z.string().trim().min(1, 'Choose a reward.') });
