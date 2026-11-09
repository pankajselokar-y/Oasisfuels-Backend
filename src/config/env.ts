import 'dotenv/config';
import { z } from 'zod';

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
    /** Lifetime of the access token. Short, because the app silently renews it with its refresh token. */
    JWT_EXPIRES_IN: z.string().default('1h'),
    CORS_ORIGINS: z.string().default('*'),
    /** Only used to read older proof photos that were saved as files; new photos are stored in the database. */
    UPLOAD_DIR: z.string().default('uploads'),
    DEFAULT_CUSTOMER_PIN: z.string().regex(/^\d{4}$/, 'DEFAULT_CUSTOMER_PIN must be 4 digits').default('1234'),
    /**
     * SMS verification (a code texted at sign-up and on "forgot PIN"). OFF by default: the app works without sending any SMS.
     * Set OTP_ENABLED=true (and FAST2SMS_API_KEY) to turn it back on; no code needs to change.
     */
    OTP_ENABLED: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    /** Without a key, OTP codes are printed to the server console instead of sent (development only). */
    FAST2SMS_API_KEY: z
      .string()
      .trim()
      .optional()
      .transform((value) => value || undefined),
  })
  .refine((env) => env.NODE_ENV !== 'production' || env.JWT_SECRET.length >= 32, {
    path: ['JWT_SECRET'],
    message: 'JWT_SECRET must be at least 32 characters in production',
  })
  .refine((env) => env.NODE_ENV !== 'production' || !env.OTP_ENABLED || Boolean(env.FAST2SMS_API_KEY), {
    path: ['FAST2SMS_API_KEY'],
    message: 'FAST2SMS_API_KEY is required in production when OTP_ENABLED=true so OTP codes can be sent',
  });

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const problems = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  console.error(`Invalid environment configuration:\n${problems}`);
  process.exit(1);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === 'production';
