import { Router, type Request } from 'express';
import { validate } from '../../shared/middleware/index.js';
import {
  ByCountryQuery,
  ByDepartmentQuery,
  ByLevelQuery,
  DistributionQuery,
  HeadcountTrendQuery,
  SummaryQuery,
} from './analytics.schema.js';
import type { AnalyticsService } from './analytics.service.js';
import type { AnalyticsFilters } from './analytics.types.js';

type FilterQuery = { country?: string; department?: number; level?: AnalyticsFilters['level'] };

function filtersOf(req: Request): AnalyticsFilters {
  const { country, department, level } = req.query as unknown as FilterQuery;
  return { country, departmentId: department, level };
}

/** Insight endpoints: read-only aggregates over active employees' current pay. */
export function analyticsRoutes(service: AnalyticsService): Router {
  const router = Router();

  router.get('/summary', validate({ query: SummaryQuery }), async (req, res) => {
    res.json(await service.summary(filtersOf(req)));
  });

  router.get('/by-country', validate({ query: ByCountryQuery }), async (req, res) => {
    // No top-level currency: each row carries its own (local) currency plus USD totals.
    res.json({ data: await service.byCountry(filtersOf(req)) });
  });

  router.get('/by-department', validate({ query: ByDepartmentQuery }), async (req, res) => {
    res.json({ currency: 'USD', data: await service.byDepartment(filtersOf(req)) });
  });

  router.get('/by-level', validate({ query: ByLevelQuery }), async (req, res) => {
    res.json(await service.byLevel(filtersOf(req)));
  });

  router.get('/distribution', validate({ query: DistributionQuery }), async (req, res) => {
    const { buckets } = req.query as unknown as DistributionQuery;
    res.json(await service.distribution(filtersOf(req), buckets));
  });

  router.get('/headcount-trend', validate({ query: HeadcountTrendQuery }), async (req, res) => {
    res.json({ data: await service.headcountTrend(filtersOf(req)) });
  });

  return router;
}
