import { Prisma } from '../../generated/prisma/client.js';
import type { Level } from '../../generated/prisma/enums.js';
import type { PrismaClient } from '../../shared/db/index.js';
import { toMoneyString } from '../../shared/utils/index.js';
import {
  activePaySql,
  analyticsConditionsSql,
  medianSql,
  statsSql,
  type PayColumn,
} from './analytics.sql.js';
import type {
  AnalyticsFilters,
  CountryBreakdown,
  DepartmentBreakdown,
  LevelBreakdown,
  PayStats,
  PaySummary,
} from './analytics.types.js';

type Money = Prisma.Decimal | null;

export interface ValueRange {
  count: number;
  min: number;
  max: number;
}

export interface AnalyticsRepository {
  summary(filters: AnalyticsFilters): Promise<PaySummary>;
  byCountry(filters: AnalyticsFilters): Promise<CountryBreakdown[]>;
  byDepartment(filters: AnalyticsFilters): Promise<DepartmentBreakdown[]>;
  byLevel(filters: AnalyticsFilters, column: PayColumn): Promise<LevelBreakdown[]>;
  valueRange(filters: AnalyticsFilters, column: PayColumn): Promise<ValueRange>;
  /** Counts per bucket (1-based); a value equal to `end` goes into the last bucket. */
  histogram(
    filters: AnalyticsFilters,
    column: PayColumn,
    plan: { start: string; end: string; count: number },
  ): Promise<Map<number, number>>;
  hiresByYear(filters: AnalyticsFilters): Promise<{ year: number; hires: number }[]>;
}

const money = (value: Money) => (value === null ? null : toMoneyString(value));

interface StatsRow {
  avg_value: Money;
  median_value: Money;
  min_value: Money;
  max_value: Money;
}

const toStats = (row: StatsRow): PayStats => ({
  average: money(row.avg_value),
  median: money(row.median_value),
  min: money(row.min_value),
  max: money(row.max_value),
});

export function createAnalyticsRepository(prisma: PrismaClient): AnalyticsRepository {
  return {
    async summary(filters) {
      const [row] = await prisma.$queryRaw<
        [{ headcount: number; total: Prisma.Decimal; average: Money; median: Money }]
      >`
        WITH pay AS (${activePaySql(filters)})
        SELECT count(*)::int AS headcount,
               ROUND(COALESCE(SUM(total_usd), 0), 2) AS total,
               ROUND(AVG(total_usd), 2) AS average,
               ${medianSql('total_usd')} AS median
        FROM pay`;
      return {
        headcount: row.headcount,
        currency: 'USD',
        totalPay: toMoneyString(row.total),
        averagePay: money(row.average),
        medianPay: money(row.median),
      };
    },

    async byCountry(filters) {
      const rows = await prisma.$queryRaw<
        (StatsRow & {
          code: string;
          name: string;
          currency: string;
          headcount: number;
          total: Prisma.Decimal;
          total_usd: Prisma.Decimal;
        })[]
      >`
        WITH pay AS (${activePaySql(filters)})
        SELECT p.country_code AS code, co.name, p.currency, count(*)::int AS headcount,
               SUM(p.total) AS total, ROUND(SUM(p.total_usd), 2) AS total_usd,
               ${statsSql('base')}
        FROM pay p
        JOIN countries co ON co.code = p.country_code
        GROUP BY p.country_code, co.name, p.currency
        ORDER BY total_usd DESC, p.country_code`;
      return rows.map((r) => ({
        country: { code: r.code, name: r.name },
        currency: r.currency,
        headcount: r.headcount,
        totalPay: toMoneyString(r.total),
        totalPayUsd: toMoneyString(r.total_usd),
        base: toStats(r),
      }));
    },

    async byDepartment(filters) {
      const rows = await prisma.$queryRaw<
        (StatsRow & { id: number; name: string; headcount: number; total_usd: Prisma.Decimal })[]
      >`
        WITH pay AS (${activePaySql(filters)})
        SELECT d.id, d.name, count(*)::int AS headcount,
               ROUND(SUM(p.total_usd), 2) AS total_usd,
               ${statsSql('base_usd')}
        FROM pay p
        JOIN departments d ON d.id = p.department_id
        GROUP BY d.id, d.name
        ORDER BY total_usd DESC, d.name`;
      return rows.map((r) => ({
        department: { id: r.id, name: r.name },
        headcount: r.headcount,
        totalPayUsd: toMoneyString(r.total_usd),
        base: { average: money(r.avg_value), median: money(r.median_value) },
      }));
    },

    async byLevel(filters, column) {
      const rows = await prisma.$queryRaw<(StatsRow & { level: Level; headcount: number })[]>`
        WITH pay AS (${activePaySql(filters)})
        SELECT level::text AS level, count(*)::int AS headcount, ${statsSql(column)}
        FROM pay
        GROUP BY level
        ORDER BY level`;
      return rows.map((r) => ({ level: r.level, headcount: r.headcount, base: toStats(r) }));
    },

    async valueRange(filters, column) {
      const value = Prisma.raw(column);
      const [row] = await prisma.$queryRaw<[{ count: number; min: Money; max: Money }]>`
        WITH pay AS (${activePaySql(filters)})
        SELECT count(*)::int AS count, MIN(${value}) AS min, MAX(${value}) AS max FROM pay`;
      return { count: row.count, min: Number(row.min ?? 0), max: Number(row.max ?? 0) };
    },

    async histogram(filters, column, plan) {
      const value = Prisma.raw(column);
      const rows = await prisma.$queryRaw<{ bucket: number; count: number }[]>`
        WITH pay AS (${activePaySql(filters)})
        SELECT LEAST(width_bucket(${value}, ${plan.start}::numeric, ${plan.end}::numeric, ${plan.count}::int), ${plan.count}::int) AS bucket,
               count(*)::int AS count
        FROM pay
        GROUP BY 1`;
      return new Map(rows.map((r) => [r.bucket, r.count]));
    },

    async hiresByYear(filters) {
      return prisma.$queryRaw<{ year: number; hires: number }[]>`
        SELECT EXTRACT(YEAR FROM e.hire_date)::int AS year, count(*)::int AS hires
        FROM employees e
        WHERE e.status = 'ACTIVE' ${analyticsConditionsSql(filters)}
        GROUP BY 1
        ORDER BY 1`;
    },
  };
}
