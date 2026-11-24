import { defineConfig } from 'prisma/config';

// Prisma 7 does not read .env by itself. Load it when present (local dev);
// in CI/production the variables come from the environment.
try {
  process.loadEnvFile('.env');
} catch {
  // no .env file: rely on the real environment
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed/index.ts',
  },
  datasource: {
    // Optional so `prisma generate` works without a database (e.g. in CI).
    url: process.env.DATABASE_URL,
  },
});
