import {
  ConflictError,
  NotFoundError,
  ValidationError,
  type ErrorDetail,
} from '../../shared/errors/index.js';
import { pageMeta, type Clock, type Paginated } from '../../shared/utils/index.js';
import type { ReferenceRepository } from '../reference/index.js';
import { employeesToCsv } from './employee.csv.js';
import type { EmployeeRepository } from './employee.repository.js';
import type { CreateEmployeeBody, UpdateEmployeeBody } from './employee.schema.js';
import type {
  EmployeeDetail,
  EmployeeFilters,
  EmployeeListItem,
  EmployeeSort,
} from './employee.types.js';

/** Rows per CSV chunk written to the response. */
export const EXPORT_CHUNK_SIZE = 1_000;

export interface ListEmployeesInput {
  filters: EmployeeFilters;
  sort: EmployeeSort;
  page: number;
  pageSize: number;
}

export interface EmployeesService {
  list(input: ListEmployeesInput): Promise<Paginated<EmployeeListItem>>;
  /** CSV of every employee matching the filters, produced in chunks. */
  exportCsv(filters: EmployeeFilters, sort: EmployeeSort): AsyncGenerator<string>;
  getById(id: number): Promise<EmployeeDetail>;
  create(input: CreateEmployeeBody): Promise<EmployeeDetail>;
  update(id: number, changes: UpdateEmployeeBody): Promise<EmployeeDetail>;
}

export interface EmployeesServiceDeps {
  employees: EmployeeRepository;
  reference: Pick<ReferenceRepository, 'findCountry' | 'findDepartment'>;
  clock: Clock;
}

const emailTaken = (email: string) =>
  new ConflictError('An employee with this email already exists', [
    { path: 'body.email', message: `${email} is already in use` },
  ]);

export function createEmployeesService({
  employees,
  reference,
  clock,
}: EmployeesServiceDeps): EmployeesService {
  async function getById(id: number): Promise<EmployeeDetail> {
    const employee = await employees.findDetail(id);
    if (!employee) throw new NotFoundError(`Employee ${id} not found`);
    return employee;
  }

  /**
   * One query for the whole result (~10k rows, ~1.5 MB of CSV), then streamed
   * in chunks. A single query is far cheaper than OFFSET batches, which re-sort
   * and re-aggregate on every batch. Beyond ~100k rows this should switch to a
   * server-side cursor.
   */
  async function* chunks(filters: EmployeeFilters, sort: EmployeeSort) {
    const rows = await employees.listAll(filters, sort);
    for (let i = 0; i < rows.length; i += EXPORT_CHUNK_SIZE) {
      yield rows.slice(i, i + EXPORT_CHUNK_SIZE);
    }
  }

  return {
    async list({ filters, sort, page, pageSize }) {
      const [data, total] = await Promise.all([
        employees.list(filters, sort, pageSize, (page - 1) * pageSize),
        employees.count(filters),
      ]);
      return { data, meta: pageMeta(page, pageSize, total) };
    },

    exportCsv: (filters, sort) => employeesToCsv(chunks(filters, sort)),

    getById,

    async create(input) {
      const [country, department, existingId] = await Promise.all([
        reference.findCountry(input.countryCode),
        reference.findDepartment(input.departmentId),
        employees.findIdByEmail(input.email),
      ]);

      const details: ErrorDetail[] = [];
      if (!country)
        details.push({ path: 'body.countryCode', message: `Unknown country ${input.countryCode}` });
      if (!department) {
        details.push({
          path: 'body.departmentId',
          message: `Unknown department ${input.departmentId}`,
        });
      }
      // v1 has no future-dated pay (data-model R6), so no future hires either.
      if (input.hireDate > clock.today()) {
        details.push({ path: 'body.hireDate', message: 'Hire date cannot be in the future' });
      }
      if (details.length > 0 || !country)
        throw new ValidationError('Request validation failed', details);
      if (existingId !== null) throw emailTaken(input.email);

      const { compensation, ...employee } = input;
      const id = await employees.create({
        ...employee,
        compensation: {
          // Currency always follows the country (R3); it is never accepted from the client.
          currency: country.currency,
          effectiveFrom: input.hireDate,
          reason: 'New hire',
          components: compensation.components,
        },
      });
      return getById(id);
    },

    async update(id, changes) {
      const current = await employees.findIdentity(id);
      if (!current) throw new NotFoundError(`Employee ${id} not found`);

      const { countryCode, ...fields } = changes;
      if (countryCode !== undefined && countryCode !== current.countryCode) {
        // Pay history is recorded in the original country's currency (R3).
        throw new ValidationError('Country cannot be changed', [
          {
            path: 'body.countryCode',
            message:
              'Country cannot be changed once compensation is recorded; relocations are not supported yet',
          },
        ]);
      }
      if (
        fields.departmentId !== undefined &&
        !(await reference.findDepartment(fields.departmentId))
      ) {
        throw new ValidationError('Request validation failed', [
          { path: 'body.departmentId', message: `Unknown department ${fields.departmentId}` },
        ]);
      }
      if (fields.email !== undefined && fields.email !== current.email) {
        const ownerId = await employees.findIdByEmail(fields.email);
        if (ownerId !== null && ownerId !== id) throw emailTaken(fields.email);
      }

      if (Object.keys(fields).length > 0) await employees.update(id, fields);
      return getById(id);
    },
  };
}
