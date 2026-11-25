import { describe, expect, it, vi } from 'vitest';
import {
  createAnalyticsService,
  type AnalyticsRepository,
} from '../../src/modules/analytics/index.js';
import {
  activePaySql,
  analyticsConditionsSql,
  medianSql,
  statsSql,
} from '../../src/modules/analytics/analytics.sql.js';
import { DistributionQuery, SummaryQuery } from '../../src/modules/analytics/analytics.schema.js';
import { ValidationError } from '../../src/shared/errors/index.js';

describe('analytics SQL', () => {
  it('only counts active employees and their open compensation', () => {
    const sql = activePaySql({}).text;

    expect(sql).toContain("WHERE e.status = 'ACTIVE'");
    expect(sql).toContain('c.effective_to IS NULL');
  });

  it('binds filters as parameters', () => {
    const conditions = analyticsConditionsSql({ country: 'IN', departmentId: 3, level: 'L2' });

    expect(conditions.text).toBe(
      'AND e.country_code = $1 AND e.department_id = $2 AND e.level = CAST($3 AS "Level")',
    );
    expect(conditions.values).toEqual(['IN', 3, 'L2']);
    expect(analyticsConditionsSql({}).text).toBe('');
  });

  it('computes the median with percentile_cont, rounded back to cents', () => {
    expect(medianSql('total_usd').text).toBe(
      'ROUND((percentile_cont(0.5) WITHIN GROUP (ORDER BY total_usd))::numeric, 2)',
    );
    expect(statsSql('base').text).toContain('ROUND(AVG(base), 2) AS avg_value');
  });
});

describe('analytics query parameters', () => {
  it('defaults to 10 buckets and coerces numbers', () => {
    expect(DistributionQuery.parse({ country: 'gb', level: 'L3', department: '2' })).toEqual({
      country: 'GB',
      level: 'L3',
      department: 2,
      buckets: 10,
    });
  });

  it.each([[{ buckets: '1' }], [{ buckets: '51' }], [{ level: 'L9' }]])(
    'rejects distribution query %j',
    (query) => {
      expect(DistributionQuery.safeParse(query).success).toBe(false);
    },
  );

  it('rejects filters an endpoint does not support', () => {
    expect(SummaryQuery.safeParse({ level: 'L1' }).success).toBe(false);
  });
});

describe('AnalyticsService', () => {
  function setup(range = { count: 4, min: 18_000, max: 200_000 }) {
    const analytics = {
      byLevel: vi.fn(async () => []),
      valueRange: vi.fn(async () => range),
      histogram: vi.fn(
        async () =>
          new Map([
            [1, 2],
            [4, 1],
          ]),
      ),
    } as unknown as AnalyticsRepository;
    const reference = {
      findCountry: vi.fn(async (code: string) =>
        code === 'IN' ? { code: 'IN', name: 'India', currency: 'INR' } : null,
      ),
      findDepartment: vi.fn(async (id: number) =>
        id === 1 ? { id: 1, name: 'Engineering' } : null,
      ),
    };
    return { service: createAnalyticsService({ analytics, reference }), analytics };
  }

  it('reports in local currency within one country and in USD across countries', async () => {
    const { service, analytics } = setup();

    await expect(service.byLevel({ country: 'IN' })).resolves.toMatchObject({ currency: 'INR' });
    expect(analytics.byLevel).toHaveBeenLastCalledWith({ country: 'IN' }, 'base');

    await expect(service.byLevel({})).resolves.toMatchObject({ currency: 'USD' });
    expect(analytics.byLevel).toHaveBeenLastCalledWith({}, 'base_usd');
  });

  it('rejects unknown country and department filters together', async () => {
    const { service } = setup();

    const error = await service
      .byLevel({ country: 'FR', departmentId: 9 })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).details?.map((d) => d.path)).toEqual([
      'query.country',
      'query.department',
    ]);
  });

  it('builds every bucket, including empty ones, from the plan', async () => {
    const { service, analytics } = setup();

    const result = await service.distribution({}, 4);

    expect(analytics.histogram).toHaveBeenCalledWith({}, 'base_usd', {
      start: '0.00',
      end: '200000.00',
      count: 4,
    });
    expect(result).toEqual({
      currency: 'USD',
      data: [
        { from: '0.00', to: '50000.00', count: 2 },
        { from: '50000.00', to: '100000.00', count: 0 },
        { from: '100000.00', to: '150000.00', count: 0 },
        { from: '150000.00', to: '200000.00', count: 1 },
      ],
    });
  });

  it('returns no buckets when nobody matches', async () => {
    const { service, analytics } = setup({ count: 0, min: 0, max: 0 });

    await expect(service.distribution({ country: 'IN' }, 10)).resolves.toEqual({
      currency: 'INR',
      data: [],
    });
    expect(analytics.histogram).not.toHaveBeenCalled();
  });
});
