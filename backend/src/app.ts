import cookieParser from 'cookie-parser';
import express, { type Express } from 'express';
import helmet from 'helmet';
import type { AppServices } from './container.js';
import {
  protectedAuthRoutes,
  publicAuthRoutes,
  requireAuth,
  type LoginRateLimit,
  type SessionCookieConfig,
} from './modules/auth/index.js';
import { analyticsRoutes } from './modules/analytics/index.js';
import { compensationRoutes } from './modules/compensation/index.js';
import { employeeRoutes } from './modules/employees/index.js';
import { healthRoutes } from './modules/health/health.routes.js';
import { referenceRoutes } from './modules/reference/index.js';
import { createErrorHandler, notFound } from './shared/middleware/index.js';

/**
 * Everything the app needs from the outside world. server.ts passes real
 * implementations; tests pass fakes, so API tests do not need a database
 * unless they exercise one.
 */
export interface AppDependencies {
  checkDatabase: () => Promise<void>;
  services: AppServices;
  cookie: SessionCookieConfig;
  loginRateLimit?: LoginRateLimit;
  /** Reverse proxies in front of the API, so req.ip is the real client. */
  trustProxy?: number;
  logger?: Pick<Console, 'error'>;
}

/** Builds the Express app without listening, so tests can drive it with Supertest. */
export function createApp(deps: AppDependencies): Express {
  const { services } = deps;
  const app = express();
  app.set('trust proxy', deps.trustProxy ?? 0);

  app.use(helmet());
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  const api = express.Router();
  const authDeps = {
    service: services.auth,
    cookie: deps.cookie,
    loginRateLimit: deps.loginRateLimit,
  };

  // Public routes.
  api.use('/health', healthRoutes({ checkDatabase: deps.checkDatabase }));
  api.use('/auth', publicAuthRoutes(authDeps));

  // Everything registered below the guard requires a valid session (protected by default).
  api.use(requireAuth(services.auth));
  api.use('/auth', protectedAuthRoutes(authDeps));
  api.use(referenceRoutes(services.reference));
  api.use('/employees/:id/compensation', compensationRoutes(services.compensation));
  api.use('/employees', employeeRoutes(services.employees));
  api.use('/analytics', analyticsRoutes(services.analytics));

  app.use('/api', api);

  app.use(notFound);
  app.use(createErrorHandler(deps.logger));

  return app;
}
