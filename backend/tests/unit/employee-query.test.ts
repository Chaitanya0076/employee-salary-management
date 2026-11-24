import { describe, expect, it } from 'vitest';
import { ListEmployeesQuery, parseSort } from '../../src/modules/employees/employee.schema.js';
import {
  SEARCH_EXPRESSION,
  employeeOrderSql,
  employeeListSql,
  employeeWhereSql,
  escapeLike,
} from '../../src/modules/employees/employee.sql.js';

describe('parseSort', () => {
  it.each([
    ['name', { field: 'name', direction: 'asc' }],
    ['totalUsd:desc', { field: 'totalUsd', direction: 'desc' }],
    ['hireDate:asc', { field: 'hireDate', direction: 'asc' }],
  ])('parses %s', (value, expected) => {
    expect(parseSort(value)).toEqual(expected);
  });

  it.each(['salary', 'name:up', 'name:asc:extra', '', 'NAME'])('rejects %j', (value) => {
    expect(parseSort(value)).toBeNull();
  });
});

describe('ListEmployeesQuery', () => {
  it('applies defaults', () => {
    expect(ListEmployeesQuery.parse({})).toEqual({
      page: 1,
      pageSize: 25,
      sort: { field: 'name', direction: 'asc' },
    });
  });

  it('coerces and normalises values from the query string', () => {
    expect(
      ListEmployeesQuery.parse({
        page: '3',
        pageSize: '50',
        q: '  smith ',
        country: 'gb',
        department: '2',
        level: 'L3',
        status: 'ACTIVE',
        sort: 'baseSalary:desc',
      }),
    ).toEqual({
      page: 3,
      pageSize: 50,
      q: 'smith',
      country: 'GB',
      department: 2,
      level: 'L3',
      status: 'ACTIVE',
      sort: { field: 'baseSalary', direction: 'desc' },
    });
  });

  it('treats an empty search as no search', () => {
    expect(ListEmployeesQuery.parse({ q: '   ' }).q).toBeUndefined();
  });

  it.each([
    [{ pageSize: '101' }],
    [{ page: '0' }],
    [{ country: 'GBR' }],
    [{ level: 'L7' }],
    [{ q: 'x'.repeat(101) }],
    [{ unknown: '1' }],
  ])('rejects %j', (query) => {
    expect(ListEmployeesQuery.safeParse(query).success).toBe(false);
  });
});

describe('employee list SQL', () => {
  it('builds no WHERE clause without filters', () => {
    expect(employeeWhereSql({}).text).toBe('');
  });

  it('searches with exactly the trigram index expression, binding an escaped pattern', () => {
    const where = employeeWhereSql({ q: '50%_off\\' });

    expect(where.text).toBe(`WHERE ${SEARCH_EXPRESSION.text} LIKE lower($1)`);
    expect(where.values).toEqual(['%50\\%\\_off\\\\%']);
    // Kept in sync with employees_search_trgm_idx in the init migration.
    expect(SEARCH_EXPRESSION.text).toBe(
      "lower(e.first_name || ' ' || e.last_name || ' ' || e.email || ' ' || e.employee_code)",
    );
  });

  it('binds every filter value as a parameter and casts enums', () => {
    const where = employeeWhereSql({
      country: 'GB',
      departmentId: 2,
      level: 'L3',
      status: 'ACTIVE',
    });

    expect(where.text).toBe(
      'WHERE e.country_code = $1 AND e.department_id = $2 AND e.level = CAST($3 AS "Level") AND e.status = CAST($4 AS "EmployeeStatus")',
    );
    expect(where.values).toEqual(['GB', 2, 'L3', 'ACTIVE']);
  });

  it('escapes LIKE wildcards', () => {
    expect(escapeLike('100%_\\')).toBe('100\\%\\_\\\\');
  });

  it.each([
    [{ field: 'name', direction: 'asc' }, 'ORDER BY e.last_name ASC, e.first_name ASC, e.id ASC'],
    [{ field: 'baseSalary', direction: 'desc' }, 'ORDER BY base_usd DESC NULLS LAST, e.id ASC'],
    [{ field: 'totalUsd', direction: 'asc' }, 'ORDER BY total_usd ASC NULLS LAST, e.id ASC'],
  ] as const)('orders by a whitelisted column with an id tie-breaker: %j', (sort, expected) => {
    expect(employeeOrderSql(sort).text).toBe(expected);
  });

  it('picks the page from employees alone for column sorts, then computes pay for those rows', () => {
    const query = employeeListSql(
      { country: 'GB' },
      { field: 'name', direction: 'asc' },
      { limit: 25, offset: 50 },
    );

    expect(query.text).toContain(
      'FROM (SELECT * FROM employees e WHERE e.country_code = $1 ORDER BY',
    );
    expect(query.text).toContain('LIMIT $2 OFFSET $3) e');
    expect(query.text).toContain('LATERAL');
    expect(query.values).toEqual(['GB', 25, 50]);
  });

  it('aggregates pay once for all rows when sorting by pay or exporting', () => {
    const paySort = employeeListSql(
      {},
      { field: 'totalUsd', direction: 'desc' },
      { limit: 25, offset: 0 },
    );
    const exportAll = employeeListSql({}, { field: 'name', direction: 'asc' });

    for (const query of [paySort, exportAll]) {
      expect(query.text).not.toContain('LATERAL');
      expect(query.text).toContain('GROUP BY c.employee_id, c.currency');
    }
    expect(exportAll.text).not.toContain('LIMIT');
  });
});
