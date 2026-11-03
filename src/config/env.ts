import 'dotenv/config';
import { z } from 'zod';

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
    JWT_EXPIRES_IN: z.string().default('7d'),
    CORS_ORIGINS: z.string().default('*'),
    UPLOAD_DIR: z.string().default('uploads'),
    DEFAULT_CUSTOMER_PIN: z.string().regex(/^\d{4}$/, 'DEFAULT_CUSTOMER_PIN must be 4 digits').default('1234'),
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
  .refine((env) => env.NODE_ENV !== 'production' || Boolean(env.FAST2SMS_API_KEY), {
    path: ['FAST2SMS_API_KEY'],
    message: 'FAST2SMS_API_KEY is required in production so OTP codes can be sent',
  });

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const problems = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  console.error(`Invalid environment configuration:\n${problems}`);
  process.exit(1);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === 'production';
