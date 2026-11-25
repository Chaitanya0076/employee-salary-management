import { z } from 'zod';

/**
 * Environment variables, validated once at startup so misconfiguration fails fast.
 * New variables (e.g. REDIS_URL) are added in the steps that use them.
 */
const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
    /** HS256 signing key for session tokens. Generate with: openssl rand -base64 48 */
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
    /** Session lifetime; the cookie expires at the same time as the token. */
    JWT_TTL_MINUTES: z.coerce
      .number()
      .int()
      .min(5)
      .max(7 * 24 * 60)
      .default(8 * 60),
    /**
     * Number of reverse proxies in front of the API (Vercel rewrite, Render router).
     * Needed so rate limiting sees the real client IP. 0 = connect directly.
     */
    TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),
    /**
     * Adds the raw X-Forwarded-For chain to access logs. Turn on briefly after a
     * deploy to calibrate TRUST_PROXY (docs/deployment.md), then off again.
     */
    LOG_FORWARDED_FOR: z.stringbool().default(false),
  })
  .refine((env) => env.NODE_ENV !== 'production' || !/change-me/i.test(env.JWT_SECRET), {
    path: ['JWT_SECRET'],
    message: 'JWT_SECRET still has the example placeholder value; set a real secret in production',
  });

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = EnvSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Invalid environment configuration:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
