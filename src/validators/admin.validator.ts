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

export const updateSettingsBody = z
  .object({
    fuelRatePerLitre: z.coerce.number().int().positive().optional(),
    minFuelAmountRupees: z.coerce.number().int().positive().optional(),
    referralBonusPoints: z.coerce.number().int().nonnegative().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), { message: 'Nothing to update.' });

/** `days` is a number of days, or "all" for the whole history. Defaults to the 45-day window. */
export const issuedItemsQuery = z
  .object({
    days: z.union([z.literal('all'), z.coerce.number().int().positive().max(3650)]).default(45),
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
