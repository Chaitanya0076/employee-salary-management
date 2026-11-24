import { Router } from 'express';

export interface HealthResponse {
  status: 'ok';
  uptimeSeconds: number;
  timestamp: string;
}

/** Public liveness endpoint. A database check is added once Prisma is wired in. */
export function healthRoutes(): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    const payload: HealthResponse = {
      status: 'ok',
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
    res.json(payload);
  });

  return router;
}
