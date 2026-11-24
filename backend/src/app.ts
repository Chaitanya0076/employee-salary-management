import cookieParser from 'cookie-parser';
import express, { type Express } from 'express';
import helmet from 'helmet';
import {
  protectedAuthRoutes,
  publicAuthRoutes,
  requireAuth,
  type AuthService,
  type LoginRateLimit,
  type SessionCookieConfig,
} from './modules/auth/index.js';
import { healthRoutes } from './modules/health/health.routes.js';
import { createErrorHandler, notFound } from './shared/middleware/index.js';

/**
 * Everything the app needs from the outside world. server.ts passes real
 * implementations; tests pass fakes, so API tests do not need a database
 * unless they exercise one.
 */
export interface AppDependencies {
  checkDatabase: () => Promise<void>;
  authService: AuthService;
  cookie: SessionCookieConfig;
  loginRateLimit?: LoginRateLimit;
  /** Reverse proxies in front of the API, so req.ip is the real client. */
  trustProxy?: number;
  logger?: Pick<Console, 'error'>;
}

/** Builds the Express app without listening, so tests can drive it with Supertest. */
export function createApp(deps: AppDependencies): Express {
  const app = express();
  app.set('trust proxy', deps.trustProxy ?? 0);

  app.use(helmet());
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  const api = express.Router();
  const authDeps = {
    service: deps.authService,
    cookie: deps.cookie,
    loginRateLimit: deps.loginRateLimit,
  };

  // Public routes.
  api.use('/health', healthRoutes({ checkDatabase: deps.checkDatabase }));
  api.use('/auth', publicAuthRoutes(authDeps));

  // Everything registered below the guard requires a valid session (protected by default).
  api.use(requireAuth(deps.authService));
  api.use('/auth', protectedAuthRoutes(authDeps));

  app.use('/api', api);

  app.use(notFound);
  app.use(createErrorHandler(deps.logger));

  return app;
}
