import { rateLimit } from 'express-rate-limit';

const tooMany = {
  error: { code: 'TOO_MANY_REQUESTS', message: 'Too many attempts. Please wait a few minutes and try again.' },
};

/**
 * Broad per-IP cap on the whole API, to blunt scripts and runaway clients. Generous on purpose: a pump's Wi-Fi, or a mobile
 * carrier, puts many real users behind one address, and every signed-in device refreshes every 20 seconds.
 */
export const apiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 3000,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: tooMany,
  skip: (req) => req.path === '/health',
});

/** Broad per-IP cap on the whole auth surface (also shared addresses, so not too tight: the per-account limit does the real work). */
export const authIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
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

/** Per signed-in customer: caps wrong-PIN guesses on the "change PIN" and "delete account" confirmations. */
export const pinConfirmLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: tooMany,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `pin:${req.auth?.sub ?? 'anonymous'}`,
  validate: { keyGeneratorIpFallback: false },
});
