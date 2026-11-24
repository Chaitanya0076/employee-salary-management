import express, { type Express } from 'express';
import helmet from 'helmet';
import { healthRoutes } from './modules/health/health.routes.js';
import { createErrorHandler, notFound } from './shared/middleware/index.js';

/**
 * Everything the app needs from the outside world. server.ts passes real
 * implementations; tests pass fakes, so API tests do not need a database
 * unless they exercise one.
 */
export interface AppDependencies {
  checkDatabase: () => Promise<void>;
  logger?: Pick<Console, 'error'>;
}

/** Builds the Express app without listening, so tests can drive it with Supertest. */
export function createApp(deps: AppDependencies): Express {
  const app = express();

  app.use(helmet());
  app.use(express.json({ limit: '100kb' }));

  const api = express.Router();
  api.use('/health', healthRoutes({ checkDatabase: deps.checkDatabase }));
  app.use('/api', api);

  app.use(notFound);
  app.use(createErrorHandler(deps.logger));

  return app;
}
