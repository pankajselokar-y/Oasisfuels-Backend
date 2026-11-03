import { rateLimit } from 'express-rate-limit';

const tooMany = {
  error: { code: 'TOO_MANY_REQUESTS', message: 'Too many attempts. Please wait a few minutes and try again.' },
};

/** Broad per-IP cap on the whole auth surface. */
export const authIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: tooMany,
});

/** Each OTP is a paid SMS, so cap how many one IP can trigger (on top of the per-phone limits in OtpService). */
export const otpSendIpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 15,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: tooMany,
});

/**
 * Per-account cap on login attempts, so a 4-digit PIN cannot be brute-forced even from many IPs.
 * Keyed by the phone number / username being attempted.
 */
export const loginAttemptLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: tooMany,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `login:${String(req.body?.phone ?? req.body?.username ?? 'unknown').toLowerCase()}`,
  validate: { keyGeneratorIpFallback: false },
});
