import { describe, expect, it, vi } from 'vitest';
import type { EmployeeRepository } from '../../src/modules/employees/employee.repository.js';
import type { CreateEmployeeBody } from '../../src/modules/employees/employee.schema.js';
import {
  EXPORT_CHUNK_SIZE,
  createEmployeesService,
} from '../../src/modules/employees/employee.service.js';
import type {
  EmployeeDetail,
  EmployeeListItem,
} from '../../src/modules/employees/employee.types.js';
import { ConflictError, NotFoundError, ValidationError } from '../../src/shared/errors/index.js';

const TODAY = '2026-06-15';
const SORT = { field: 'name', direction: 'asc' } as const;

const detail = (id: number) => ({ id }) as EmployeeDetail;

function fakeRepository(overrides: Partial<EmployeeRepository> = {}): EmployeeRepository {
  return {
    list: vi.fn(async () => []),
    listAll: vi.fn(async () => []),
    count: vi.fn(async () => 0),
    findDetail: vi.fn(async (id: number) => detail(id)),
    findIdentity: vi.fn(async (id: number) => ({
      id,
      email: 'bob@acme.example',
      countryCode: 'GB',
    })),
    findIdByEmail: vi.fn(async () => null),
    create: vi.fn(async () => 42),
    update: vi.fn(async () => {}),
    ...overrides,
  };
}

function setup(repoOverrides: Partial<EmployeeRepository> = {}) {
  const employees = fakeRepository(repoOverrides);
  const reference = {
    findCountry: vi.fn(async (code: string) =>
      code === 'IN' ? { code: 'IN', name: 'India', currency: 'INR' } : null,
    ),
    findDepartment: vi.fn(async (id: number) => (id === 1 ? { id: 1, name: 'Engineering' } : null)),
  };
  const service = createEmployeesService({ employees, reference, clock: { today: () => TODAY } });
  return { service, employees };
}

const newHire: CreateEmployeeBody = {
  firstName: 'Farah',
  lastName: 'Khan',
  email: 'farah.khan@acme.example',
  jobTitle: 'Software Engineer',
  level: 'L2',
  hireDate: '2026-05-01',
  countryCode: 'IN',
  departmentId: 1,
  compensation: { components: [{ type: 'BASE', amount: '1200000' }] },
};

async function rejection(promise: Promise<unknown>) {
  return promise.then(
    () => {
      throw new Error('expected a rejection');
    },
    (err: unknown) => err,
  );
}

describe('EmployeesService.list', () => {
  it('translates page/pageSize to limit/offset and builds page meta', async () => {
    const { service, employees } = setup({ count: vi.fn(async () => 51) });

    const result = await service.list({
      filters: { country: 'GB' },
      sort: SORT,
      page: 3,
      pageSize: 25,
    });

    expect(employees.list).toHaveBeenCalledWith({ country: 'GB' }, SORT, 25, 50);
    expect(result.meta).toEqual({ page: 3, pageSize: 25, total: 51, totalPages: 3 });
  });
});

describe('EmployeesService.exportCsv', () => {
  it('runs a single query and emits a header plus one row per employee, in chunks', async () => {
    const row = {
      employeeCode: 'EMP-1',
      country: { name: 'X' },
      department: { name: 'Y' },
      pay: null,
    } as EmployeeListItem;
    const rows = Array.from({ length: EXPORT_CHUNK_SIZE + 1 }, () => row);
    const listAll = vi.fn(async () => rows);
    const { service } = setup({ listAll });

    const chunks: string[] = [];
    for await (const chunk of service.exportCsv({ country: 'GB' }, SORT)) chunks.push(chunk);

    expect(listAll).toHaveBeenCalledExactlyOnceWith({ country: 'GB' }, SORT);
    expect(chunks).toHaveLength(3); // header, a full chunk, the remainder
    expect(chunks.join('').trimEnd().split('\r\n')).toHaveLength(1 + rows.length);
  });
});

describe('EmployeesService.getById', () => {
  it('throws NotFoundError for an unknown id', async () => {
    const { service } = setup({ findDetail: vi.fn(async () => null) });

    await expect(service.getById(7)).rejects.toThrow(new NotFoundError('Employee 7 not found'));
  });
});

describe('EmployeesService.create', () => {
  it('derives the currency from the country and starts pay on the hire date', async () => {
    const { service, employees } = setup();

    await expect(service.create(newHire)).resolves.toEqual(detail(42));

    expect(employees.create).toHaveBeenCalledWith({
      firstName: 'Farah',
      lastName: 'Khan',
      email: 'farah.khan@acme.example',
      jobTitle: 'Software Engineer',
      level: 'L2',
      hireDate: '2026-05-01',
      countryCode: 'IN',
      departmentId: 1,
      compensation: {
        currency: 'INR',
        effectiveFrom: '2026-05-01',
        reason: 'New hire',
        components: [{ type: 'BASE', amount: '1200000' }],
      },
    });
  });

  it('allows a hire date of today', async () => {
    const { service } = setup();

    await expect(service.create({ ...newHire, hireDate: TODAY })).resolves.toBeDefined();
  });

  it('reports an unknown country, unknown department and future hire date together', async () => {
    const { service, employees } = setup();

    const error = await rejection(
      service.create({ ...newHire, countryCode: 'FR', departmentId: 9, hireDate: '2026-06-16' }),
    );

    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).details?.map((d) => d.path)).toEqual([
      'body.countryCode',
      'body.departmentId',
      'body.hireDate',
    ]);
    expect(employees.create).not.toHaveBeenCalled();
  });

  it('rejects an email that is already in use', async () => {
    const { service, employees } = setup({ findIdByEmail: vi.fn(async () => 3) });

    await expect(service.create(newHire)).rejects.toBeInstanceOf(ConflictError);
    expect(employees.create).not.toHaveBeenCalled();
  });
});

describe('EmployeesService.update', () => {
  it('applies the changes and returns the refreshed employee', async () => {
    const { service, employees } = setup();

    await expect(service.update(5, { jobTitle: 'Lead', level: 'L4' })).resolves.toEqual(detail(5));
    expect(employees.update).toHaveBeenCalledWith(5, { jobTitle: 'Lead', level: 'L4' });
  });

  it('throws NotFoundError for an unknown employee', async () => {
    const { service } = setup({ findIdentity: vi.fn(async () => null) });

    await expect(service.update(5, { jobTitle: 'Lead' })).rejects.toBeInstanceOf(NotFoundError);
  });

  it('refuses to change the country, because pay history is in its currency', async () => {
    const { service, employees } = setup();

    const error = await rejection(service.update(5, { countryCode: 'US' }));

    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).details?.[0]?.path).toBe('body.countryCode');
    expect(employees.update).not.toHaveBeenCalled();
  });

  it('treats the unchanged country as a no-op and does not write', async () => {
    const { service, employees } = setup();

    await service.update(5, { countryCode: 'GB' });

    expect(employees.update).not.toHaveBeenCalled();
  });

  it('rejects an unknown department', async () => {
    const { service } = setup();

    await expect(service.update(5, { departmentId: 9 })).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects another employee's email but accepts the employee's own", async () => {
    const { service } = setup({ findIdByEmail: vi.fn(async () => 99) });
    await expect(service.update(5, { email: 'taken@acme.example' })).rejects.toBeInstanceOf(
      ConflictError,
    );

    const own = setup({ findIdByEmail: vi.fn(async () => 5) });
    await expect(own.service.update(5, { email: 'new@acme.example' })).resolves.toBeDefined();
  });
});
