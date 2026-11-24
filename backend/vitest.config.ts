import { defineConfig } from 'vitest/config';

/**
 * Two projects:
 * - unit: no database (unit tests + API tests with fake services). Fast; run anywhere.
 * - integration: real PostgreSQL test database (created and migrated by the global setup).
 *   Files run one at a time because they share the database.
 */
export default defineConfig({
  test: {
    environment: 'node',
    clearMocks: true,
    restoreMocks: true,
    env: { NODE_ENV: 'test' },
    projects: [
      {
        extends: true,
        test: { name: 'unit', include: ['tests/unit/**/*.test.ts', 'tests/api/**/*.test.ts'] },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.ts'],
          globalSetup: ['tests/integration/global-setup.ts'],
          fileParallelism: false,
        },
      },
    ],
  },
});
