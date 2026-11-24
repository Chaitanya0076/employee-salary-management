import request from 'supertest';
import { createApp } from '../../src/app.js';
import { createServices } from '../../src/container.js';
import { createPrismaClient, type PrismaClient } from '../../src/shared/db/index.js';
import { generateSeedData } from '../../prisma/seed/generate.js';
import {
  TEST_JWT_SECRET,
  TEST_PASSWORD,
  hrUser,
  testAuthService,
  testPasswordHasher,
} from '../helpers/auth.js';
import { TEST_DATABASE_URL, assertIsTestDatabase } from './test-database.js';

/** Fixed "today" so date rules are deterministic. */
export const TODAY = '2026-06-15';

let prisma: PrismaClient | undefined;

export function testPrisma(): PrismaClient {
  assertIsTestDatabase(TEST_DATABASE_URL);
  prisma ??= createPrismaClient(TEST_DATABASE_URL);
  return prisma;
}

export async function disconnectTestPrisma(): Promise<void> {
  await prisma?.$disconnect();
  prisma = undefined;
}

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

type Pay = { BASE: number; BONUS?: number; ALLOWANCE?: number };
const components = (pay: Pay) =>
  Object.entries(pay).map(([type, amount]) => ({
    type: type as keyof Pay,
    amount: String(amount),
  }));

/**
 * Hand-written employees with known values, so assertions can state exact
 * expectations. USD equivalents use the seed FX rates (GBP 1.27, INR 0.012, EUR 1.08).
 *
 * | # | Name            | Country | Dept        | Level | Status   | Base (local) | Base USD  | Total USD |
 * | 1 | Alice Smith     | US      | Engineering | L3    | ACTIVE   | 120,000      | 120,000   | 132,000   |
 * | 2 | Bob Jones       | GB      | Sales       | L2    | ACTIVE   | 50,000       | 63,500    | 66,040    |
 * | 3 | Chitra Rao      | IN      | Engineering | L2    | ACTIVE   | 1,500,000    | 18,000    | 19,800    |
 * | 4 | Dieter Müller   | DE      | Finance     | L4    | INACTIVE | 90,000       | 97,200    | 97,200    |
 * | 5 | Emma Smithson   | US      | Product     | L5    | ACTIVE   | 200,000      | 200,000   | 240,000   |
 */
export const FIXTURE_EMPLOYEES = [
  {
    firstName: 'Alice',
    lastName: 'Smith',
    email: 'alice.smith@acme.example',
    jobTitle: 'Senior Software Engineer',
    level: 'L3',
    status: 'ACTIVE',
    hireDate: '2020-01-15',
    countryCode: 'US',
    departmentId: 1,
    history: [
      {
        from: '2020-01-15',
        to: '2023-04-01',
        currency: 'USD',
        reason: 'New hire',
        pay: { BASE: 100_000 },
      },
      {
        from: '2023-04-01',
        to: null,
        currency: 'USD',
        reason: 'Promotion',
        pay: { BASE: 120_000, BONUS: 12_000 },
      },
    ],
  },
  {
    firstName: 'Bob',
    lastName: 'Jones',
    email: 'bob.jones@acme.example',
    jobTitle: 'Account Executive',
    level: 'L2',
    status: 'ACTIVE',
    hireDate: '2021-03-01',
    countryCode: 'GB',
    departmentId: 2,
    history: [
      {
        from: '2021-03-01',
        to: null,
        currency: 'GBP',
        reason: 'New hire',
        pay: { BASE: 50_000, ALLOWANCE: 2_000 },
      },
    ],
  },
  {
    firstName: 'Chitra',
    lastName: 'Rao',
    email: 'chitra.rao@acme.example',
    jobTitle: 'Software Engineer',
    level: 'L2',
    status: 'ACTIVE',
    hireDate: '2022-06-01',
    countryCode: 'IN',
    departmentId: 1,
    history: [
      {
        from: '2022-06-01',
        to: null,
        currency: 'INR',
        reason: 'New hire',
        pay: { BASE: 1_500_000, BONUS: 150_000 },
      },
    ],
  },
  {
    firstName: 'Dieter',
    lastName: 'Müller',
    email: 'dieter.muller@acme.example',
    jobTitle: 'Lead Financial Analyst',
    level: 'L4',
    status: 'INACTIVE',
    hireDate: '2019-09-01',
    countryCode: 'DE',
    departmentId: 7,
    history: [
      { from: '2019-09-01', to: null, currency: 'EUR', reason: 'New hire', pay: { BASE: 90_000 } },
    ],
  },
  {
    firstName: 'Emma',
    lastName: 'Smithson',
    email: 'emma.smithson@acme.example',
    jobTitle: 'Product Manager',
    level: 'L5',
    status: 'ACTIVE',
    hireDate: '2018-02-01',
    countryCode: 'US',
    departmentId: 6,
    history: [
      {
        from: '2018-02-01',
        to: null,
        currency: 'USD',
        reason: 'New hire',
        pay: { BASE: 200_000, BONUS: 40_000 },
      },
    ],
  },
] as const;

const TABLES_IN_DELETE_ORDER = [
  'compensation_components',
  'compensations',
  'employees',
  'departments',
  'countries',
  'fx_rates',
  'users',
] as const;

/**
 * Wipes the test database and loads reference data plus the fixture employees.
 * Uses DELETE + sequence restarts rather than TRUNCATE: for a handful of rows
 * TRUNCATE is ~10x slower (it recreates and fsyncs table files).
 */
export async function resetDatabase(): Promise<void> {
  const db = testPrisma();
  const reference = generateSeedData({ employeeCount: 0, seed: 1, referenceDate: TODAY });

  const employees = FIXTURE_EMPLOYEES.map(({ history: _history, hireDate, ...e }, i) => ({
    ...e,
    id: i + 1,
    employeeCode: `EMP-${String(i + 1).padStart(5, '0')}`,
    hireDate: d(hireDate),
  }));
  const history = FIXTURE_EMPLOYEES.flatMap((e, i) =>
    e.history.map((h) => ({ ...h, employeeId: i + 1 })),
  );
  const compensations = history.map((h, i) => ({
    id: i + 1,
    employeeId: h.employeeId,
    currency: h.currency,
    effectiveFrom: d(h.from),
    effectiveTo: h.to ? d(h.to) : null,
    reason: h.reason,
  }));
  const componentRows = history.flatMap((h, i) =>
    components(h.pay).map((c) => ({ ...c, compensationId: i + 1 })),
  );

  await db.$transaction([
    ...TABLES_IN_DELETE_ORDER.map((table) => db.$executeRawUnsafe(`DELETE FROM ${table}`)),
    // Restart before inserting: rows inserted without explicit ids draw from these.
    db.$executeRaw`ALTER SEQUENCE compensation_components_id_seq RESTART WITH 1`,
    db.$executeRaw`ALTER SEQUENCE users_id_seq RESTART WITH 1`,
    db.fxRate.createMany({ data: reference.fxRates }),
    db.country.createMany({ data: reference.countries }),
    db.department.createMany({ data: reference.departments }),
    db.employee.createMany({ data: employees }),
    db.compensation.createMany({ data: compensations }),
    db.compensationComponent.createMany({ data: componentRows }),
    // Continue sequences after the explicit ids, so API-created rows are predictable.
    db.$executeRaw`SELECT setval('departments_id_seq', ${reference.departments.length})`,
    db.$executeRaw`SELECT setval('employees_id_seq', ${employees.length})`,
    db.$executeRaw`SELECT setval('compensations_id_seq', ${compensations.length})`,
  ]);
}

/** The real app over the test database; auth uses the in-memory HR user. */
export function buildIntegrationApp() {
  const services = createServices({
    prisma: testPrisma(),
    jwt: { secret: TEST_JWT_SECRET, ttlMinutes: 60 },
    clock: { today: () => TODAY },
    passwords: testPasswordHasher(),
  });
  return createApp({
    checkDatabase: async () => {},
    services: { ...services, auth: testAuthService() },
    cookie: { secure: false },
    logger: { error: () => {} },
  });
}

/** A Supertest agent that is already logged in (it keeps the session cookie). */
export async function loggedInAgent() {
  const agent = request.agent(buildIntegrationApp());
  await agent
    .post('/api/auth/login')
    .send({ email: hrUser.email, password: TEST_PASSWORD })
    .expect(200);
  return agent;
}
