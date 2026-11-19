import { z } from 'zod';
import { INACTIVE_VEHICLE_DAYS } from '../config/constants.js';
import { paginationQuery } from '../utils/pagination.js';
import { name, staffPassword, username } from './common.js';

export const createStaffBody = z.object({
  name,
  username,
  password: staffPassword,
  role: z.enum(['ADMIN', 'CASHIER']),
});

/** At least one field must be present; a blank password means "keep the current one". */
export const updateStaffBody = z
  .object({
    name: name.optional(),
    username: username.optional(),
    password: staffPassword.optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), { message: 'Nothing to update.' });

export const setActiveBody = z.object({ active: z.boolean() });

export const changeOwnPasswordBody = z.object({
  currentPassword: z.string().min(1, 'Current password is required.'),
  newPassword: staffPassword,
});

/** Rupees per litre, as the pump board shows it: at least ₹1, up to 2 decimals (99.38, 112.97). */
const fuelRate = z.coerce
  .number()
  .min(1, 'The fuel rate must be at least ₹1 per litre.')
  .max(10_000, 'The fuel rate is too high.')
  .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, 'Enter the rate with at most 2 decimal places, for example 99.38.')
  // Stored with exactly the digits the admin typed (no floating-point drift like 99.38000000000001).
  .transform((v) => Math.round(v * 100) / 100);

// A GPS coordinate, or null to clear it (z.coerce would turn null into 0, so null is matched first).
const coordinate = (min: number, max: number, label: string) =>
  z.union([z.null(), z.coerce.number().min(min, `${label} is out of range.`).max(max, `${label} is out of range.`)]);

export const updateSettingsBody = z
  .object({
    fuelRatePerLitre: fuelRate.optional(),
    minFuelAmountRupees: z.coerce.number().int().positive().max(100_000, 'The minimum fill-up is too high.').optional(),
    referralBonusPoints: z.coerce.number().int().nonnegative().max(100_000, 'The referral bonus is too high.').optional(),
    pumpLatitude: coordinate(-90, 90, 'The latitude').optional(),
    pumpLongitude: coordinate(-180, 180, 'The longitude').optional(),
    /** How close to the pump a photo must be taken, in metres. */
    geofenceMeters: z.coerce.number().int().min(50, 'The allowed distance must be at least 50 m.').max(2000, 'The allowed distance can be at most 2,000 m.').optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), { message: 'Nothing to update.' })
  // The pump's location is one point: both numbers, or neither (to switch the check off).
  .refine((v) => (v.pumpLatitude === undefined) === (v.pumpLongitude === undefined), {
    message: 'Send the pump latitude and longitude together.',
  })
  .refine((v) => (v.pumpLatitude === null) === (v.pumpLongitude === null), {
    message: 'Send both the pump latitude and longitude, or clear both.',
  })
  // Exactly 0,0 is what a failed GPS read looks like (a point in the sea), never a real pump.
  .refine((v) => !(v.pumpLatitude === 0 && v.pumpLongitude === 0), {
    message: 'The location looks like a failed GPS reading. Try again outdoors.',
  });

/** `days` is a number of days (30, 60, 90…), or "all" for the whole history. Defaults to the last 30 days. */
export const issuedItemsQuery = z
  .object({
    days: z.union([z.literal('all'), z.coerce.number().int().positive().max(3650)]).default(30),
    /** Custom range, as YYYY-MM-DD. When given it replaces `days`; `to` includes the whole of that day. */
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
  })
  .transform((q) => ({
    days: q.days,
    from: q.from ? new Date(`${q.from}T00:00:00.000Z`) : undefined,
    to: q.to ? new Date(`${q.to}T23:59:59.999Z`) : undefined,
  }))
  .refine((q) => !q.from || !q.to || q.from <= q.to, { message: 'The start date must be on or before the end date.' });

/** How long without a fuel fill makes a vehicle "inactive" (default 30 days), paged. */
export const inactiveVehiclesQuery = paginationQuery.extend({
  days: z.coerce.number().int().min(1).max(3650).default(INACTIVE_VEHICLE_DAYS),
});
