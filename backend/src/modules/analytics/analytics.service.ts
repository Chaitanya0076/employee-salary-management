import { ValidationError, type ErrorDetail } from '../../shared/errors/index.js';
import type { ReferenceRepository } from '../reference/index.js';
import type { AnalyticsRepository } from './analytics.repository.js';
import { planBuckets } from './analytics.buckets.js';
import type { PayColumn } from './analytics.sql.js';
import type {
  AnalyticsFilters,
  CountryBreakdown,
  CurrencyScoped,
  DepartmentBreakdown,
  HeadcountYear,
  HistogramBucket,
  LevelBreakdown,
  PaySummary,
} from './analytics.types.js';

export interface AnalyticsService {
  summary(filters: AnalyticsFilters): Promise<PaySummary>;
  byCountry(filters: AnalyticsFilters): Promise<CountryBreakdown[]>;
  byDepartment(filters: AnalyticsFilters): Promise<DepartmentBreakdown[]>;
  byLevel(filters: AnalyticsFilters): Promise<CurrencyScoped<LevelBreakdown[]>>;
  distribution(
    filters: AnalyticsFilters,
    buckets: number,
  ): Promise<CurrencyScoped<HistogramBucket[]>>;
  headcountTrend(filters: AnalyticsFilters): Promise<HeadcountYear[]>;
}

export interface AnalyticsServiceDeps {
  analytics: AnalyticsRepository;
  reference: Pick<ReferenceRepository, 'findCountry' | 'findDepartment'>;
}

/** Fills the years with no hires so the trend has no gaps. */
export function toHeadcountTrend(
  hires: readonly { year: number; hires: number }[],
): HeadcountYear[] {
  const first = hires[0];
  const last = hires.at(-1);
  if (!first || !last) return [];
  const byYear = new Map(hires.map((h) => [h.year, h.hires]));
  const trend: HeadcountYear[] = [];
  let cumulative = 0;
  for (let year = first.year; year <= last.year; year++) {
    const count = byYear.get(year) ?? 0;
    cumulative += count;
    trend.push({ year, hires: count, cumulative });
  }
  return trend;
}

const edge = (value: number) => value.toFixed(2);

export function createAnalyticsService({
  analytics,
  reference,
}: AnalyticsServiceDeps): AnalyticsService {
  /**
   * Unknown filter values are reported as 400s rather than silently returning
   * empty insights. Returns the currency to report in: the country's own when
   * filtered to one country, otherwise USD.
   */
  async function resolve(filters: AnalyticsFilters): Promise<string> {
    const [country, department] = await Promise.all([
      filters.country ? reference.findCountry(filters.country) : null,
      filters.departmentId ? reference.findDepartment(filters.departmentId) : null,
    ]);
    const details: ErrorDetail[] = [];
    if (filters.country && !country) {
      details.push({ path: 'query.country', message: `Unknown country ${filters.country}` });
    }
    if (filters.departmentId && !department) {
      details.push({
        path: 'query.department',
        message: `Unknown department ${filters.departmentId}`,
      });
    }
    if (details.length > 0) throw new ValidationError('Request validation failed', details);
    return country?.currency ?? 'USD';
  }

  /** Local amounts are only comparable within one country; across countries use USD. */
  const baseColumn = (filters: AnalyticsFilters): PayColumn =>
    filters.country ? 'base' : 'base_usd';

  return {
    async summary(filters) {
      await resolve(filters);
      return analytics.summary(filters);
    },

    async byCountry(filters) {
      await resolve(filters);
      return analytics.byCountry(filters);
    },

    async byDepartment(filters) {
      await resolve(filters);
      return analytics.byDepartment(filters);
    },

    async byLevel(filters) {
      const currency = await resolve(filters);
      return { currency, data: await analytics.byLevel(filters, baseColumn(filters)) };
    },

    async distribution(filters, requested) {
      const currency = await resolve(filters);
      const column = baseColumn(filters);
      const range = await analytics.valueRange(filters, column);
      if (range.count === 0) return { currency, data: [] };

      const plan = planBuckets(range.min, range.max, requested);
      const end = plan.start + plan.step * plan.count;
      const counts = await analytics.histogram(filters, column, {
        start: edge(plan.start),
        end: edge(end),
        count: plan.count,
      });
      const data = Array.from({ length: plan.count }, (_, i) => ({
        from: edge(plan.start + plan.step * i),
        to: edge(plan.start + plan.step * (i + 1)),
        count: counts.get(i + 1) ?? 0,
      }));
      return { currency, data };
    },

    async headcountTrend(filters) {
      await resolve(filters);
      return toHeadcountTrend(await analytics.hiresByYear(filters));
    },
  };
}
