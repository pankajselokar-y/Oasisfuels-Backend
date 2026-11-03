import { z } from 'zod';
import { name, phone, pin, vehicleInput } from './common.js';

const otp = z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code from the SMS.');

export const customerLoginBody = z.object({ phone, pin: z.string().min(1, 'PIN is required.') });

export const staffLoginBody = z.object({
  username: z.string().trim().min(1, 'Username is required.'),
  password: z.string().min(1, 'Password is required.'),
});

/** Ask for a code by SMS. Registration and PIN reset are the two things a code unlocks. */
export const sendOtpBody = z.object({
  phone,
  purpose: z.enum(['REGISTER', 'RESET_PIN']),
});

/** Check a code without spending it, so a screen can say "wrong code" before the final step. */
export const verifyOtpBody = sendOtpBody.extend({ otp });

export const registerBody = z.object({
  name,
  phone,
  pin,
  /** The code sent to `phone` by POST /auth/otp/send (purpose REGISTER). */
  otp,
  vehicle: vehicleInput.optional(),
  /** A friend's mobile number. */
  referralCode: z.string().trim().optional(),
});

/** Everything about a sign-up that can be checked before a paid SMS code is sent. */
export const checkRegistrationBody = z.object({
  phone,
  vehicle: vehicleInput.optional(),
  referralCode: z.string().trim().optional(),
});

export const refreshBody = z.object({ refreshToken: z.string().min(20, 'Invalid session.').max(200) });

export const resetPinBody = z.object({ phone, otp, newPin: pin });
