/**
 * Building blocks for insight queries. Every aggregate runs in PostgreSQL over
 * the same set: ACTIVE employees and their current (open) compensation.
 */
import { Prisma } from '../../generated/prisma/client.js';
import type { AnalyticsFilters } from './analytics.types.js';

export function analyticsConditionsSql(filters: AnalyticsFilters): Prisma.Sql {
  const conditions: Prisma.Sql[] = [];
  if (filters.country) conditions.push(Prisma.sql`e.country_code = ${filters.country}`);
  if (filters.departmentId) conditions.push(Prisma.sql`e.department_id = ${filters.departmentId}`);
  if (filters.level) conditions.push(Prisma.sql`e.level = CAST(${filters.level} AS "Level")`);
  return conditions.length > 0 ? Prisma.sql`AND ${Prisma.join(conditions, ' AND ')}` : Prisma.empty;
}

/**
 * One row per active employee with current base/total pay in local currency
 * and unrounded USD equivalents (rounding happens once, on the aggregate).
 */
export function activePaySql(filters: AnalyticsFilters): Prisma.Sql {
  return Prisma.sql`
    SELECT e.id, e.country_code, e.department_id, e.level, c.currency,
           SUM(cc.amount) FILTER (WHERE cc.type = 'BASE') AS base,
           SUM(cc.amount) AS total,
           SUM(cc.amount) FILTER (WHERE cc.type = 'BASE') * fx.rate_to_usd AS base_usd,
           SUM(cc.amount) * fx.rate_to_usd AS total_usd
    FROM employees e
    JOIN compensations c ON c.employee_id = e.id AND c.effective_to IS NULL
    JOIN compensation_components cc ON cc.compensation_id = c.id
    JOIN fx_rates fx ON fx.currency = c.currency
    WHERE e.status = 'ACTIVE' ${analyticsConditionsSql(filters)}
    GROUP BY e.id, c.currency, fx.rate_to_usd`;
}

/** Whitelisted value columns; the only raw SQL interpolated into queries. */
export type PayColumn = 'base' | 'base_usd' | 'total' | 'total_usd';

/**
 * Median via percentile_cont (averages the two middle values for even counts).
 * percentile_cont works in double precision; rounding back to numeric(2dp) is
 * exact for amounts of this size (< 1e13).
 */
export function medianSql(column: PayColumn): Prisma.Sql {
  return Prisma.raw(`ROUND((percentile_cont(0.5) WITHIN GROUP (ORDER BY ${column}))::numeric, 2)`);
}

/** avg/median/min/max of a pay column, rounded to cents. */
export function statsSql(column: PayColumn): Prisma.Sql {
  return Prisma.sql`
    ROUND(AVG(${Prisma.raw(column)}), 2) AS avg_value,
    ${medianSql(column)} AS median_value,
    ROUND(MIN(${Prisma.raw(column)}), 2) AS min_value,
    ROUND(MAX(${Prisma.raw(column)}), 2) AS max_value`;
}
