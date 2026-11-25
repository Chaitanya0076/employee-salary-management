import { Router, type Request, type Response } from 'express';
import { validate } from '../../shared/middleware/index.js';
import { EmployeeCompensationParams, PayChangeBody } from './compensation.schema.js';
import type { CompensationService } from './compensation.service.js';

/** Mounted at /api/employees/:id/compensation. */
export function compensationRoutes(service: CompensationService): Router {
  const router = Router({ mergeParams: true });

  router.get(
    '/',
    validate({ params: EmployeeCompensationParams }),
    async (req: Request, res: Response) => {
      const { id } = req.params as unknown as EmployeeCompensationParams;
      res.json(await service.getHistory(id));
    },
  );

  router.post(
    '/',
    validate({ params: EmployeeCompensationParams, body: PayChangeBody }),
    async (req: Request, res: Response) => {
      const { id } = req.params as unknown as EmployeeCompensationParams;
      const result = await service.changePay(id, req.body as PayChangeBody);
      res.status(201).location(`/api/employees/${id}/compensation`).json(result);
    },
  );

  return router;
}
