/**
 * Seeds the database with deterministic demo data (10,000 employees).
 * Re-runnable: wipes all tables first, inside one transaction.
 *
 *   npm run db:seed
 */
import bcrypt from 'bcryptjs';
import { createPrismaClient } from '../../src/shared/db/index.js';
import { parseSeedEnv } from './config.js';
import { DEFAULT_SEED_OPTIONS, generateSeedData } from './generate.js';

try {
  process.loadEnvFile('.env');
} catch {
  // rely on the real environment
}

const BATCH_SIZE = 5_000;
const BCRYPT_COST = 12;

const toDate = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

function chunks<T>(rows: readonly T[], size = BATCH_SIZE): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

async function main(): Promise<void> {
  const env = parseSeedEnv(process.env);

  const started = performance.now();
  const data = generateSeedData(DEFAULT_SEED_OPTIONS);
  const generatedMs = performance.now() - started;
  const passwordHash = await bcrypt.hash(env.SEED_HR_PASSWORD, BCRYPT_COST);

  const prisma = createPrismaClient(env.DATABASE_URL);
  try {
    await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`
          TRUNCATE TABLE compensation_components, compensations, employees,
                         departments, countries, fx_rates, users
          RESTART IDENTITY CASCADE`;

        await tx.fxRate.createMany({ data: data.fxRates });
        await tx.country.createMany({ data: data.countries });
        await tx.department.createMany({ data: data.departments });

        for (const batch of chunks(data.employees)) {
          await tx.employee.createMany({
            data: batch.map((e) => ({ ...e, hireDate: toDate(e.hireDate) })),
          });
        }
        for (const batch of chunks(data.compensations)) {
          await tx.compensation.createMany({
            data: batch.map((c) => ({
              ...c,
              effectiveFrom: toDate(c.effectiveFrom),
              effectiveTo: c.effectiveTo ? toDate(c.effectiveTo) : null,
            })),
          });
        }
        for (const batch of chunks(data.components)) {
          await tx.compensationComponent.createMany({ data: batch });
        }

        // Explicit ids were inserted, so move sequences past them.
        await tx.$queryRaw`SELECT setval(pg_get_serial_sequence('departments', 'id'), (SELECT MAX(id) FROM departments))`;
        await tx.$queryRaw`SELECT setval(pg_get_serial_sequence('employees', 'id'), (SELECT MAX(id) FROM employees))`;
        await tx.$queryRaw`SELECT setval(pg_get_serial_sequence('compensations', 'id'), (SELECT MAX(id) FROM compensations))`;

        await tx.user.create({
          data: { email: env.SEED_HR_EMAIL, passwordHash, name: 'HR Manager', role: 'HR_MANAGER' },
        });
      },
      { timeout: 120_000 },
    );
  } finally {
    await prisma.$disconnect();
  }

  const totalMs = performance.now() - started;
  console.log(
    [
      'Seed complete:',
      `  ${data.countries.length} countries, ${data.fxRates.length} FX rates, ${data.departments.length} departments`,
      `  ${data.employees.length} employees, ${data.compensations.length} compensation records, ${data.components.length} components`,
      `  HR Manager login: ${env.SEED_HR_EMAIL}`,
      `  generated in ${Math.round(generatedMs)} ms, total ${(totalMs / 1000).toFixed(1)} s`,
    ].join('\n'),
  );
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
