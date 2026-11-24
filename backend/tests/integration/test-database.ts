/** The integration tests' own database; never the development database. */
export const TEST_DATABASE_URL =
  process.env['TEST_DATABASE_URL'] ??
  'postgresql://salary:salary@localhost:5432/salary_management_test?schema=public';

export function assertIsTestDatabase(url: string): string {
  const name = new URL(url).pathname.slice(1);
  if (!name.endsWith('_test')) {
    throw new Error(
      `Refusing to run integration tests against "${name}": the database name must end in _test`,
    );
  }
  return name;
}
