import { z } from 'zod';

/** The example password from .env.example must never protect a real deployment. */
const EXAMPLE_PASSWORD = /changeme/i;

const SeedEnvSchema = z
  .object({
    NODE_ENV: z.string().default('development'),
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
    SEED_HR_EMAIL: z.string().trim().toLowerCase().pipe(z.email()),
    SEED_HR_PASSWORD: z.string().min(12, 'SEED_HR_PASSWORD must be at least 12 characters'),
    /** Seeding deletes all data, so production requires an explicit opt-in. */
    SEED_ALLOW_PRODUCTION: z.stringbool().default(false),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') return;
    if (!env.SEED_ALLOW_PRODUCTION) {
      ctx.addIssue({
        code: 'custom',
        path: ['SEED_ALLOW_PRODUCTION'],
        message:
          'Refusing to wipe and seed a production database without SEED_ALLOW_PRODUCTION=true',
      });
    }
    if (EXAMPLE_PASSWORD.test(env.SEED_HR_PASSWORD)) {
      ctx.addIssue({
        code: 'custom',
        path: ['SEED_HR_PASSWORD'],
        message: 'SEED_HR_PASSWORD is the example value; choose a strong password for production',
      });
    }
  });

export type SeedEnv = z.infer<typeof SeedEnvSchema>;

export function parseSeedEnv(source: NodeJS.ProcessEnv): SeedEnv {
  const result = SeedEnvSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Invalid seed configuration:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
