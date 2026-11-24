import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  buildIntegrationApp,
  disconnectTestPrisma,
  loggedInAgent,
  resetDatabase,
} from './fixtures.js';

type Agent = Awaited<ReturnType<typeof loggedInAgent>>;
let api: Agent;

// Sessions live in the in-memory auth service, so one login per file survives database resets.
beforeAll(async () => {
  api = await loggedInAgent();
});

beforeEach(resetDatabase);

afterAll(disconnectTestPrisma);

const names = (body: { data: { firstName: string }[] }) => body.data.map((e) => e.firstName);

describe('GET /api/employees', () => {
  it('requires a session', async () => {
    await request(buildIntegrationApp()).get('/api/employees').expect(401);
  });

  it('lists employees sorted by name with their current pay summary', async () => {
    const res = await api.get('/api/employees').expect(200);

    expect(names(res.body)).toEqual(['Bob', 'Dieter', 'Chitra', 'Alice', 'Emma']);
    expect(res.body.meta).toEqual({ page: 1, pageSize: 25, total: 5, totalPages: 1 });

    const alice = res.body.data[3];
    expect(alice).toEqual({
      id: 1,
      employeeCode: 'EMP-00001',
      firstName: 'Alice',
      lastName: 'Smith',
      email: 'alice.smith@acme.example',
      jobTitle: 'Senior Software Engineer',
      level: 'L3',
      status: 'ACTIVE',
      hireDate: '2020-01-15',
      country: { code: 'US', name: 'United States' },
      department: { id: 1, name: 'Engineering' },
      // Only the current record counts; the closed 100,000 record is history.
      pay: {
        currency: 'USD',
        base: '120000.00',
        total: '132000.00',
        baseUsd: '120000.00',
        totalUsd: '132000.00',
      },
    });
    expect(res.body.data[0].pay).toEqual({
      currency: 'GBP',
      base: '50000.00',
      total: '52000.00',
      baseUsd: '63500.00',
      totalUsd: '66040.00',
    });
  });

  it('paginates with stable ordering', async () => {
    const page2 = await api.get('/api/employees?pageSize=2&page=2').expect(200);
    expect(names(page2.body)).toEqual(['Chitra', 'Alice']);
    expect(page2.body.meta).toEqual({ page: 2, pageSize: 2, total: 5, totalPages: 3 });

    const beyond = await api.get('/api/employees?pageSize=2&page=9').expect(200);
    expect(beyond.body.data).toEqual([]);
    expect(beyond.body.meta.total).toBe(5);
  });

  it.each([
    ['country (case-insensitive)', 'country=gb', ['Bob']],
    ['department', 'department=1', ['Chitra', 'Alice']],
    ['level', 'level=L2', ['Bob', 'Chitra']],
    ['status', 'status=INACTIVE', ['Dieter']],
    ['combined filters', 'country=US&level=L5', ['Emma']],
    ['search by name', 'q=smith', ['Alice', 'Emma']],
    ['search by code', 'q=emp-00003', ['Chitra']],
    ['search by email', 'q=bob.jones@', ['Bob']],
    ['search treats wildcards literally', 'q=%25', []],
  ])('filters by %s', async (_label, query, expected) => {
    const res = await api.get(`/api/employees?${query}`).expect(200);

    expect(names(res.body)).toEqual(expected);
    expect(res.body.meta.total).toBe(expected.length);
  });

  it.each([
    [
      'baseSalary:asc (USD equivalent, comparable across currencies)',
      ['Chitra', 'Bob', 'Dieter', 'Alice', 'Emma'],
    ],
    ['totalUsd:desc', ['Emma', 'Alice', 'Dieter', 'Bob', 'Chitra']],
    ['hireDate:asc', ['Emma', 'Dieter', 'Alice', 'Bob', 'Chitra']],
    ['employeeCode:desc', ['Emma', 'Dieter', 'Chitra', 'Bob', 'Alice']],
    ['name:desc', ['Emma', 'Alice', 'Chitra', 'Dieter', 'Bob']],
  ])('sorts by %s', async (sort, expected) => {
    const res = await api.get(`/api/employees?sort=${sort.split(' ')[0]}`).expect(200);

    expect(names(res.body)).toEqual(expected);
  });

  it.each([
    ['pageSize above the maximum', 'pageSize=101', 'query.pageSize'],
    ['an unknown sort field', 'sort=salary:asc', 'query.sort'],
    ['an unknown level', 'level=L9', 'query.level'],
    ['an unknown query parameter', 'departmnt=1', 'query'],
  ])('rejects %s', async (_label, query, path) => {
    const res = await api.get(`/api/employees?${query}`).expect(400);

    expect(res.body.error.details.map((d: { path: string }) => d.path)).toContain(path);
  });
});

describe('GET /api/employees/export', () => {
  it('returns a CSV attachment of the filtered list, ignoring pagination', async () => {
    const res = await api.get('/api/employees/export?country=US&sort=totalUsd:desc').expect(200);

    expect(res.headers['content-type']).toBe('text/csv; charset=utf-8');
    expect(res.headers['content-disposition']).toMatch(
      /^attachment; filename="employees-\d{4}-\d{2}-\d{2}\.csv"$/,
    );
    expect(res.text.startsWith('﻿')).toBe(true);

    const lines = res.text.slice(1).trimEnd().split('\r\n');
    expect(lines).toEqual([
      'Employee Code,First Name,Last Name,Email,Job Title,Level,Status,Hire Date,Country,Department,Currency,Base Salary,Total Compensation,Base Salary (USD),Total Compensation (USD)',
      'EMP-00005,Emma,Smithson,emma.smithson@acme.example,Product Manager,L5,ACTIVE,2018-02-01,United States,Product,USD,200000.00,240000.00,200000.00,240000.00',
      'EMP-00001,Alice,Smith,alice.smith@acme.example,Senior Software Engineer,L3,ACTIVE,2020-01-15,United States,Engineering,USD,120000.00,132000.00,120000.00,132000.00',
    ]);
  });

  it('neutralises spreadsheet formulas in exported cells', async () => {
    await api
      .post('/api/employees')
      .send({
        firstName: '=HYPERLINK("http://evil.example","click")',
        lastName: 'Injected',
        email: 'formula@acme.example',
        jobTitle: '+cmd',
        level: 'L1',
        hireDate: '2025-01-01',
        countryCode: 'US',
        departmentId: 1,
        compensation: { components: [{ type: 'BASE', amount: 50000 }] },
      })
      .expect(201);

    const res = await api.get('/api/employees/export?q=injected').expect(200);
    const row = res.text.trimEnd().split('\r\n')[1];

    expect(row).toContain(`"'=HYPERLINK(""http://evil.example"",""click"")"`);
    expect(row).toContain(`,'+cmd,`);
  });

  it('rejects pagination parameters on export', async () => {
    await api.get('/api/employees/export?page=2').expect(400);
  });
});

describe('GET /api/employees/:id', () => {
  it('returns details with the current compensation broken down by component', async () => {
    const res = await api.get('/api/employees/1').expect(200);

    expect(res.body).toMatchObject({
      id: 1,
      employeeCode: 'EMP-00001',
      country: { code: 'US', name: 'United States', currency: 'USD' },
      department: { id: 1, name: 'Engineering' },
      currentCompensation: {
        currency: 'USD',
        effectiveFrom: '2023-04-01',
        reason: 'Promotion',
        components: [
          { type: 'BASE', amount: '120000.00' },
          { type: 'BONUS', amount: '12000.00' },
        ],
        base: '120000.00',
        total: '132000.00',
        totalUsd: '132000.00',
      },
    });
  });

  it('converts to USD with the FX table', async () => {
    const res = await api.get('/api/employees/3').expect(200);

    expect(res.body.currentCompensation).toMatchObject({
      currency: 'INR',
      total: '1650000.00',
      baseUsd: '18000.00',
      totalUsd: '19800.00',
    });
  });

  it('returns 404 for an unknown employee and 400 for a malformed id', async () => {
    const missing = await api.get('/api/employees/9999').expect(404);
    expect(missing.body.error).toEqual({ code: 'NOT_FOUND', message: 'Employee 9999 not found' });

    await api.get('/api/employees/abc').expect(400);
  });
});

describe('POST /api/employees', () => {
  const newHire = {
    firstName: 'Farah',
    lastName: 'Khan',
    email: '  Farah.Khan@ACME.example ',
    jobTitle: 'Software Engineer',
    level: 'L2',
    hireDate: '2026-05-01',
    countryCode: 'in',
    departmentId: 1,
    compensation: {
      components: [
        { type: 'BASE', amount: '1200000.50' },
        { type: 'ALLOWANCE', amount: 60000 },
      ],
    },
  };

  it('creates the employee with initial pay in the country currency', async () => {
    const res = await api.post('/api/employees').send(newHire).expect(201);

    expect(res.headers['location']).toBe(`/api/employees/${res.body.id}`);
    expect(res.body).toMatchObject({
      id: 6,
      employeeCode: 'EMP-00006',
      email: 'farah.khan@acme.example',
      status: 'ACTIVE',
      hireDate: '2026-05-01',
      country: { code: 'IN', currency: 'INR' },
      currentCompensation: {
        currency: 'INR',
        effectiveFrom: '2026-05-01',
        reason: 'New hire',
        components: [
          { type: 'BASE', amount: '1200000.50' },
          { type: 'ALLOWANCE', amount: '60000.00' },
        ],
        total: '1260000.50',
      },
    });

    const list = await api.get('/api/employees?q=farah').expect(200);
    expect(list.body.data[0].pay.totalUsd).toBe('15120.01');
  });

  it('rejects a duplicate email with 409', async () => {
    const res = await api
      .post('/api/employees')
      .send({ ...newHire, email: 'ALICE.SMITH@acme.example' })
      .expect(409);

    expect(res.body.error).toMatchObject({ code: 'CONFLICT', details: [{ path: 'body.email' }] });
  });

  it('reports unknown references and a future hire date together', async () => {
    const res = await api
      .post('/api/employees')
      .send({ ...newHire, countryCode: 'FR', departmentId: 99, hireDate: '2026-06-16' })
      .expect(400);

    expect(res.body.error.details.map((d: { path: string }) => d.path)).toEqual([
      'body.countryCode',
      'body.departmentId',
      'body.hireDate',
    ]);
  });

  it.each([
    ['no BASE component', [{ type: 'BONUS', amount: 100 }], 'body.compensation.components'],
    [
      'a duplicate component type',
      [
        { type: 'BASE', amount: 100 },
        { type: 'BASE', amount: 200 },
      ],
      'body.compensation.components.1.type',
    ],
    ['a zero amount', [{ type: 'BASE', amount: 0 }], 'body.compensation.components.0.amount'],
    [
      'a negative amount',
      [{ type: 'BASE', amount: '-5' }],
      'body.compensation.components.0.amount',
    ],
    [
      'more than 2 decimals',
      [{ type: 'BASE', amount: '10.001' }],
      'body.compensation.components.0.amount',
    ],
  ])('rejects pay with %s', async (_label, components, path) => {
    const res = await api
      .post('/api/employees')
      .send({ ...newHire, compensation: { components } })
      .expect(400);

    expect(res.body.error.details.map((d: { path: string }) => d.path)).toContain(path);
  });

  it('does not accept a client-supplied currency or employee code', async () => {
    const res = await api
      .post('/api/employees')
      .send({
        ...newHire,
        employeeCode: 'EMP-99999',
        compensation: { ...newHire.compensation, currency: 'USD' },
      })
      .expect(400);

    // Both unknown keys are rejected (strict schemas); report order is not significant.
    expect(res.body.error.details.map((d: { path: string }) => d.path).sort()).toEqual([
      'body',
      'body.compensation',
    ]);
  });
});

describe('PATCH /api/employees/:id', () => {
  it('updates fields and returns the employee', async () => {
    const res = await api
      .patch('/api/employees/2')
      .send({ jobTitle: 'Senior Account Executive', level: 'L3', departmentId: 1 })
      .expect(200);

    expect(res.body).toMatchObject({
      jobTitle: 'Senior Account Executive',
      level: 'L3',
      department: { id: 1, name: 'Engineering' },
    });
  });

  it('deactivates and reactivates an employee', async () => {
    await api.patch('/api/employees/2').send({ status: 'INACTIVE' }).expect(200);
    const inactive = await api.get('/api/employees?status=INACTIVE').expect(200);
    expect(names(inactive.body)).toEqual(['Bob', 'Dieter']);

    const res = await api.patch('/api/employees/2').send({ status: 'ACTIVE' }).expect(200);
    expect(res.body.status).toBe('ACTIVE');
  });

  it('rejects a country change but accepts the unchanged country', async () => {
    const res = await api.patch('/api/employees/2').send({ countryCode: 'US' }).expect(400);
    expect(res.body.error.details[0].path).toBe('body.countryCode');

    await api.patch('/api/employees/2').send({ countryCode: 'gb', jobTitle: 'AE' }).expect(200);
  });

  it("rejects another employee's email, but allows keeping your own", async () => {
    await api.patch('/api/employees/2').send({ email: 'alice.smith@acme.example' }).expect(409);
    await api.patch('/api/employees/2').send({ email: 'BOB.JONES@acme.example' }).expect(200);
  });

  it('validates the body and the target', async () => {
    await api.patch('/api/employees/2').send({}).expect(400);
    await api.patch('/api/employees/2').send({ departmentId: 99 }).expect(400);
    await api.patch('/api/employees/2').send({ hireDate: '2020-01-01' }).expect(400);
    await api.patch('/api/employees/9999').send({ jobTitle: 'X' }).expect(404);
  });
});
