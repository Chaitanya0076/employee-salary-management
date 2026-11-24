import { Router } from 'express';

export type DependencyStatus = 'up' | 'down';

export interface HealthResponse {
  status: 'ok' | 'degraded';
  uptimeSeconds: number;
  timestamp: string;
  checks: { database: DependencyStatus };
}

export interface HealthDependencies {
  /** Resolves when the database answers; rejects otherwise. */
  checkDatabase: () => Promise<void>;
}

/** Public health endpoint: 200 when all dependencies are up, 503 otherwise. */
export function healthRoutes({ checkDatabase }: HealthDependencies): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    const database: DependencyStatus = await checkDatabase().then(
      () => 'up',
      () => 'down',
    );

    const payload: HealthResponse = {
      status: database === 'up' ? 'ok' : 'degraded',
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      checks: { database },
    };
    res.status(database === 'up' ? 200 : 503).json(payload);
  });

  return router;
}
