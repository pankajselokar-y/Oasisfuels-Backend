// Loyalty tiers, driven by lifetime points (the same thresholds the app shows).
export const TIERS = [
  { key: 'bronze', label: 'Bronze', min: 0 },
  { key: 'silver', label: 'Silver', min: 5000 },
  { key: 'gold', label: 'Gold', min: 20000 },
  { key: 'platinum', label: 'Platinum', min: 50000 },
] as const;

// Issue records are never deleted, so the log always covers at least this many days.
export const ISSUE_LOG_DEFAULT_DAYS = 45;

// Defaults used when the Setting row is first created.
export const DEFAULT_SETTINGS = {
  fuelRatePerLitre: 100,
  minFuelAmountRupees: 500,
  referralBonusPoints: 100,
} as const;

// How long a device stays signed in without opening the app. Each refresh restarts the clock.
export const REFRESH_TOKEN_DAYS = 30;

// One-time passcodes sent by SMS. Every SMS costs money, so sending is deliberately tightly limited.
export const OTP = {
  length: 6,
  ttlMinutes: 5,
  /** Wrong guesses allowed per code before it is invalidated. */
  maxAttempts: 5,
  /** Minimum gap between two codes for the same phone and purpose. */
  resendCooldownSeconds: 30,
  /** Codes that can be sent to one phone and purpose per rolling hour. */
  maxSendsPerHour: 5,
} as const;

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/** A vehicle that has not filled fuel for this many days raises an "inactive vehicle" alert for the admin. */
export const INACTIVE_VEHICLE_DAYS = 30;
