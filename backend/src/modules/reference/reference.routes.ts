import { Router, type Request, type Response } from 'express';
import { validate } from '../../shared/middleware/index.js';
import { FxRateParams, UpdateFxRateBody } from './reference.schema.js';
import type { ReferenceService } from './reference.service.js';

/** Reference data is small and read-mostly, so the controller is inlined here. */
export function referenceRoutes(service: ReferenceService): Router {
  const router = Router();

  router.get('/countries', async (_req, res) => {
    res.json({ data: await service.listCountries() });
  });

  router.get('/departments', async (_req, res) => {
    res.json({ data: await service.listDepartments() });
  });

  router.get('/fx-rates', async (_req, res) => {
    res.json({ data: await service.listFxRates() });
  });

  router.put(
    '/fx-rates/:currency',
    validate({ params: FxRateParams, body: UpdateFxRateBody }),
    async (req: Request, res: Response) => {
      const { currency } = req.params as unknown as FxRateParams;
      const { rateToUsd } = req.body as UpdateFxRateBody;
      res.json(await service.updateFxRate(currency, rateToUsd));
    },
  );

  return router;
}
