import { createApp } from './app.js';
import { loadEnv } from './config/env.js';
import { createServices } from './container.js';
import { createPrismaClient, pingDatabase } from './shared/db/index.js';

const env = loadEnv();
const prisma = createPrismaClient(env.DATABASE_URL);

const app = createApp({
  checkDatabase: () => pingDatabase(prisma),
  services: createServices({
    prisma,
    jwt: { secret: env.JWT_SECRET, ttlMinutes: env.JWT_TTL_MINUTES },
  }),
  cookie: { secure: env.NODE_ENV === 'production' },
  trustProxy: env.TRUST_PROXY,
  requestLog: env.NODE_ENV === 'test' ? undefined : { includeForwardedFor: env.LOG_FORWARDED_FOR },
});

const server = app.listen(env.PORT, () => {
  console.log(`API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

function shutdown(signal: NodeJS.Signals): void {
  console.log(`${signal} received, shutting down`);
  server.close(() => {
    void prisma.$disconnect().finally(() => process.exit(0));
  });
  // Force exit if open connections keep the server alive.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
