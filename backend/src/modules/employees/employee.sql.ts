/**
 * SQL fragments for the employee list. Values are always bound as parameters;
 * the only raw SQL comes from fixed whitelists below, never from user input.
 */
import { Prisma } from '../../generated/prisma/client.js';
import type { EmployeeFilters, EmployeeSort, SortDirection, SortField } from './employee.types.js';

/**
 * Must stay identical to the expression of employees_search_trgm_idx in the
 * init migration, otherwise Postgres cannot use the trigram index for `q`.
 */
export const SEARCH_EXPRESSION = Prisma.sql`lower(e.first_name || ' ' || e.last_name || ' ' || e.email || ' ' || e.employee_code)`;

/** Escapes LIKE wildcards so user input is matched literally. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

export function employeeWhereSql(filters: EmployeeFilters): Prisma.Sql {
  const conditions: Prisma.Sql[] = [];
  if (filters.q) {
    conditions.push(Prisma.sql`${SEARCH_EXPRESSION} LIKE lower(${`%${escapeLike(filters.q)}%`})`);
  }
  if (filters.country) conditions.push(Prisma.sql`e.country_code = ${filters.country}`);
  if (filters.departmentId) conditions.push(Prisma.sql`e.department_id = ${filters.departmentId}`);
  if (filters.level) conditions.push(Prisma.sql`e.level = CAST(${filters.level} AS "Level")`);
  if (filters.status)
    conditions.push(Prisma.sql`e.status = CAST(${filters.status} AS "EmployeeStatus")`);
  return conditions.length > 0
    ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`
    : Prisma.empty;
}

const DIRECTION: Record<SortDirection, string> = { asc: 'ASC', desc: 'DESC' };

const SORT_COLUMNS: Record<SortField, (dir: string) => string> = {
  name: (dir) => `e.last_name ${dir}, e.first_name ${dir}`,
  employeeCode: (dir) => `e.employee_code ${dir}`,
  hireDate: (dir) => `e.hire_date ${dir}`,
  // Pay sorts use USD equivalents so the order is meaningful across currencies;
  // within one country this is the same order as the local amount.
  baseSalary: (dir) => `base_usd ${dir} NULLS LAST`,
  totalUsd: (dir) => `total_usd ${dir} NULLS LAST`,
};

/** Deterministic ordering: the id tie-breaker keeps pages stable. */
export function employeeOrderSql({ field, direction }: EmployeeSort): Prisma.Sql {
  return Prisma.raw(`ORDER BY ${SORT_COLUMNS[field](DIRECTION[direction])}, e.id ASC`);
}

const COLUMNS = Prisma.sql`
  SELECT e.id, e.employee_code, e.first_name, e.last_name, e.email, e.job_title,
         e.level::text AS level, e.status::text AS status, e.hire_date,
         e.country_code, co.name AS country_name, e.department_id, d.name AS department_name,
         p.currency, p.base, p.total,
         ROUND(p.base * fx.rate_to_usd, 2) AS base_usd,
         ROUND(p.total * fx.rate_to_usd, 2) AS total_usd`;

const REFERENCE_JOINS = Prisma.sql`
  JOIN countries co ON co.code = e.country_code
  JOIN departments d ON d.id = e.department_id`;

/** Current pay for one employee row, found through the partial unique index. */
const PAY_PER_ROW = Prisma.sql`
  LEFT JOIN LATERAL (
    SELECT c.currency,
           SUM(cc.amount) FILTER (WHERE cc.type = 'BASE') AS base,
           SUM(cc.amount) AS total
    FROM compensations c
    JOIN compensation_components cc ON cc.compensation_id = c.id
    WHERE c.employee_id = e.id AND c.effective_to IS NULL
    GROUP BY c.currency
  ) p ON TRUE
  LEFT JOIN fx_rates fx ON fx.currency = p.currency`;

/** Current pay for every employee in one hash aggregate. */
const PAY_FOR_ALL = Prisma.sql`
  LEFT JOIN (
    SELECT c.employee_id, c.currency,
           SUM(cc.amount) FILTER (WHERE cc.type = 'BASE') AS base,
           SUM(cc.amount) AS total
    FROM compensations c
    JOIN compensation_components cc ON cc.compensation_id = c.id
    WHERE c.effective_to IS NULL
    GROUP BY c.employee_id, c.currency
  ) p ON p.employee_id = e.id
  LEFT JOIN fx_rates fx ON fx.currency = p.currency`;

const PAY_SORTS: ReadonlySet<SortField> = new Set(['baseSalary', 'totalUsd']);

export interface PageWindow {
  limit: number;
  offset: number;
}

/**
 * Employees with their current pay. Two strategies, chosen by what the request
 * needs (measurements in docs/performance.md):
 *
 * - A page sorted by an employee column (name, code, hire date): the page is
 *   chosen from `employees` alone, then pay is computed for just those rows.
 *   Cost stays flat however deep the page is.
 * - Sorting by pay, or exporting every row: pay is needed for all rows anyway,
 *   so it is computed once with a hash aggregate (~5x faster than running the
 *   per-row subquery 10,000 times).
 */
export function employeeListSql(
  filters: EmployeeFilters,
  sort: EmployeeSort,
  page?: PageWindow,
): Prisma.Sql {
  const where = employeeWhereSql(filters);
  const order = employeeOrderSql(sort);
  const window = page ? Prisma.sql`LIMIT ${page.limit} OFFSET ${page.offset}` : Prisma.empty;

  if (page && !PAY_SORTS.has(sort.field)) {
    return Prisma.sql`
      ${COLUMNS}
      FROM (SELECT * FROM employees e ${where} ${order} ${window}) e
      ${REFERENCE_JOINS}
      ${PAY_PER_ROW}
      ${order}`;
  }
  return Prisma.sql`
    ${COLUMNS}
    FROM employees e
    ${REFERENCE_JOINS}
    ${PAY_FOR_ALL}
    ${where}
    ${order}
    ${window}`;
}
