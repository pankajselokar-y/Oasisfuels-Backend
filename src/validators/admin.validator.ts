import { z } from 'zod';
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
export const issuedItemsQuery = z.object({
  days: z
    .union([z.literal('all'), z.coerce.number().int().positive().max(3650)])
    .default(45),
});
