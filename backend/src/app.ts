import express, { type Express } from 'express';
import helmet from 'helmet';
import { healthRoutes } from './modules/health/health.routes.js';
import { createErrorHandler, notFound } from './shared/middleware/index.js';

export interface AppOptions {
  logger?: Pick<Console, 'error'>;
}

/** Builds the Express app without listening, so tests can drive it with Supertest. */
export function createApp(options: AppOptions = {}): Express {
  const app = express();

  app.use(helmet());
  app.use(express.json({ limit: '100kb' }));

  const api = express.Router();
  api.use('/health', healthRoutes());
  app.use('/api', api);

  app.use(notFound);
  app.use(createErrorHandler(options.logger));

  return app;
}
