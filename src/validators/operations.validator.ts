import { z } from 'zod';
import { MAX_FUEL_LITRES, MAX_FUEL_RUPEES } from '../config/constants.js';
import { paginationQuery } from '../utils/pagination.js';
import { reviewStatus } from './common.js';

const rupees = z.coerce
  .number()
  .int('Enter a whole number of rupees.')
  .positive('Amount must be greater than zero.')
  .max(MAX_FUEL_RUPEES, `That amount is too large (the most one entry can be is ₹${MAX_FUEL_RUPEES.toLocaleString('en-IN')}).`);

/** The dashboard photo + GPS + vehicle a cashier captures while recording a fill-up. */
const proofBody = z
  .object({
    /** One of the customer's saved vehicles... */
    vehicleId: z.uuid('Select the vehicle that was fuelled.').optional(),
    /** ...or a plate typed in, for a customer who has no vehicle saved yet. */
    vehicleNumber: z.string().trim().min(1).max(20).optional(),
    vehicleModel: z.string().trim().max(60).optional(),
    latitude: z.coerce.number().min(-90).max(90),
    longitude: z.coerce.number().min(-180).max(180),
    accuracy: z.coerce.number().nonnegative().optional(),
    /** The photo as a base64 data URI. */
    photoDataUri: z
      .string()
      .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/, 'The photo must be a JPEG, PNG or WebP image.'),
  })
  .refine((v) => v.vehicleId || v.vehicleNumber, { message: 'Select or enter the vehicle that was fuelled.' })
  // Exactly 0,0 is what a failed GPS read looks like (a point in the sea), never a real pump.
  .refine((v) => !(v.latitude === 0 && v.longitude === 0), {
    message: 'The GPS location is missing. Let the phone read its location and try again.',
  });

/** A cashier records a fill-up as either the rupees paid or the litres dispensed — exactly one. */
export const fuelEntryBody = z
  .object({
    customerId: z.uuid('Invalid customer id.'),
    amountRupees: rupees.optional(),
    litres: z.coerce.number().positive().max(MAX_FUEL_LITRES, `That is too many litres (the most one entry can be is ${MAX_FUEL_LITRES}).`).optional(),
    /** Optional on the API; the app always sends it so every fill-up has a photo, location and vehicle on record. */
    proof: proofBody.optional(),
  })
  .refine((v) => (v.amountRupees === undefined) !== (v.litres === undefined), {
    message: 'Provide either amountRupees or litres.',
  });

export const approveClaimBody = z.object({ amountRupees: rupees.optional() });
export const rejectClaimBody = z.object({ reason: z.string().trim().max(300).optional() });

export const reviewListQuery = paginationQuery.extend({ status: reviewStatus.optional() });

export const requestRedemptionBody = z.object({ rewardId: z.string().trim().min(1, 'Choose a reward.').max(64) });
