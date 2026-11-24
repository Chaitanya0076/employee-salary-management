import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import pg from 'pg';
import { TEST_DATABASE_URL, assertIsTestDatabase } from './test-database.js';

/** Creates the test database if needed and applies all migrations to it. */
export default async function setup(): Promise<void> {
  const name = assertIsTestDatabase(TEST_DATABASE_URL);

  const admin = new URL(TEST_DATABASE_URL);
  admin.pathname = '/postgres';
  admin.search = '';
  const client = new pg.Client({ connectionString: admin.toString() });
  try {
    await client.connect();
  } catch (err) {
    throw new Error(
      `Cannot reach PostgreSQL for integration tests (${admin.host}). Start it with "docker compose up -d".`,
      { cause: err },
    );
  }
  try {
    const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
    if (!rowCount) await client.query(`CREATE DATABASE "${name}"`);
  } finally {
    await client.end();
  }

  // Call the local binary directly; going through npx adds noticeable startup time.
  execFileSync(resolve('node_modules/.bin/prisma'), ['migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: 'pipe',
  });
}
