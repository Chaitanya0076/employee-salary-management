import type { Prisma } from '../../generated/prisma/client.js';
import type { PrismaClient } from '../../shared/db/index.js';
import { fromIsoDate, toIsoDate, toMoneyString } from '../../shared/utils/index.js';
import { toCompensationRecord } from '../compensation/compensation.mapper.js';
import { employeeListSql, employeeWhereSql } from './employee.sql.js';
import type {
  EmployeeChanges,
  EmployeeDetail,
  EmployeeFilters,
  EmployeeIdentity,
  EmployeeListItem,
  EmployeeSort,
  EmployeeStatus,
  Level,
  NewEmployeeRecord,
} from './employee.types.js';

export interface EmployeeRepository {
  list(
    filters: EmployeeFilters,
    sort: EmployeeSort,
    limit: number,
    offset: number,
  ): Promise<EmployeeListItem[]>;
  /** Every matching employee in one query (for export). */
  listAll(filters: EmployeeFilters, sort: EmployeeSort): Promise<EmployeeListItem[]>;
  count(filters: EmployeeFilters): Promise<number>;
  findDetail(id: number): Promise<EmployeeDetail | null>;
  findIdentity(id: number): Promise<EmployeeIdentity | null>;
  findIdByEmail(email: string): Promise<number | null>;
  /** Creates the employee and their initial compensation atomically; returns the new id. */
  create(record: NewEmployeeRecord): Promise<number>;
  update(id: number, changes: EmployeeChanges): Promise<void>;
}

interface ListRow {
  id: number;
  employee_code: string;
  first_name: string;
  last_name: string;
  email: string;
  job_title: string;
  level: Level;
  status: EmployeeStatus;
  hire_date: Date;
  country_code: string;
  country_name: string;
  department_id: number;
  department_name: string;
  currency: string | null;
  base: Prisma.Decimal | null;
  total: Prisma.Decimal | null;
  base_usd: Prisma.Decimal | null;
  total_usd: Prisma.Decimal | null;
}

function toListItem(row: ListRow): EmployeeListItem {
  return {
    id: row.id,
    employeeCode: row.employee_code,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    jobTitle: row.job_title,
    level: row.level,
    status: row.status,
    hireDate: toIsoDate(row.hire_date),
    country: { code: row.country_code, name: row.country_name },
    department: { id: row.department_id, name: row.department_name },
    pay:
      row.currency && row.base && row.total && row.base_usd && row.total_usd
        ? {
            currency: row.currency,
            base: toMoneyString(row.base),
            total: toMoneyString(row.total),
            baseUsd: toMoneyString(row.base_usd),
            totalUsd: toMoneyString(row.total_usd),
          }
        : null,
  };
}

const DETAIL_INCLUDE = {
  country: { include: { fxRate: true } },
  department: true,
  compensations: {
    where: { effectiveTo: null },
    include: { components: { orderBy: { type: 'asc' } } },
  },
} satisfies Prisma.EmployeeInclude;

type DetailRow = Prisma.EmployeeGetPayload<{ include: typeof DETAIL_INCLUDE }>;

function toDetail(row: DetailRow): EmployeeDetail {
  const current = row.compensations[0];
  const currentCompensation = current
    ? toCompensationRecord(current, row.country.fxRate.rateToUsd)
    : null;
  return {
    id: row.id,
    employeeCode: row.employeeCode,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    jobTitle: row.jobTitle,
    level: row.level,
    status: row.status,
    hireDate: toIsoDate(row.hireDate),
    country: { code: row.country.code, name: row.country.name, currency: row.country.currency },
    department: { id: row.department.id, name: row.department.name },
    currentCompensation,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function employeeCode(id: number): string {
  return `EMP-${String(id).padStart(5, '0')}`;
}

export function createEmployeeRepository(prisma: PrismaClient): EmployeeRepository {
  return {
    async list(filters, sort, limit, offset) {
      const rows = await prisma.$queryRaw<ListRow[]>(
        employeeListSql(filters, sort, { limit, offset }),
      );
      return rows.map(toListItem);
    },

    async listAll(filters, sort) {
      const rows = await prisma.$queryRaw<ListRow[]>(employeeListSql(filters, sort));
      return rows.map(toListItem);
    },

    async count(filters) {
      const [row] = await prisma.$queryRaw<[{ total: number }]>`
        SELECT count(*)::int AS total FROM employees e ${employeeWhereSql(filters)}`;
      return row.total;
    },

    async findDetail(id) {
      const row = await prisma.employee.findUnique({ where: { id }, include: DETAIL_INCLUDE });
      return row && toDetail(row);
    },

    findIdentity: (id) =>
      prisma.employee.findUnique({
        where: { id },
        select: { id: true, email: true, countryCode: true },
      }),

    async findIdByEmail(email) {
      const row = await prisma.employee.findUnique({ where: { email }, select: { id: true } });
      return row?.id ?? null;
    },

    async create(record) {
      // Take the id first so the employee code can be derived from it in the same insert.
      const [{ id }] = await prisma.$queryRaw<[{ id: number }]>`
        SELECT nextval(pg_get_serial_sequence('employees', 'id'))::int AS id`;
      const { compensation, hireDate, ...employee } = record;
      // A single nested create is one atomic statement batch in Prisma.
      await prisma.employee.create({
        data: {
          ...employee,
          id,
          employeeCode: employeeCode(id),
          hireDate: fromIsoDate(hireDate),
          compensations: {
            create: {
              currency: compensation.currency,
              effectiveFrom: fromIsoDate(compensation.effectiveFrom),
              reason: compensation.reason,
              components: { create: compensation.components },
            },
          },
        },
      });
      return id;
    },

    async update(id, changes) {
      await prisma.employee.update({ where: { id }, data: changes });
    },
  };
}
