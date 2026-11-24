import bcrypt from 'bcryptjs';
import { vi } from 'vitest';
import { createApp, type AppDependencies } from '../../src/app.js';
import {
  SESSION_COOKIE,
  createAuthService,
  createBcryptPasswordHasher,
  createJwtTokenService,
  type AuthRepository,
  type AuthUserRecord,
} from '../../src/modules/auth/index.js';

export const TEST_PASSWORD = 'correct-horse-battery';
export const TEST_JWT_SECRET = 'test-secret-that-is-at-least-32-chars-long';

/** Low bcrypt cost keeps tests fast; production uses 12. */
const TEST_BCRYPT_COST = 4;

export const hrUser: AuthUserRecord = {
  id: 1,
  email: 'hr.manager@acme.example',
  name: 'HR Manager',
  role: 'HR_MANAGER',
  passwordHash: bcrypt.hashSync(TEST_PASSWORD, TEST_BCRYPT_COST),
};

export function inMemoryUsers(users: AuthUserRecord[] = [hrUser]): AuthRepository {
  return {
    findByEmail: async (email) => users.find((u) => u.email === email) ?? null,
    findById: async (id) => users.find((u) => u.id === id) ?? null,
  };
}

export function buildTestApp(overrides: Partial<AppDependencies> = {}) {
  const authService = createAuthService({
    users: inMemoryUsers(),
    passwords: createBcryptPasswordHasher(TEST_BCRYPT_COST),
    tokens: createJwtTokenService({ secret: TEST_JWT_SECRET, ttlMinutes: 60 }),
  });
  return createApp({
    checkDatabase: async () => {},
    authService,
    cookie: { secure: false },
    logger: { error: vi.fn() },
    ...overrides,
  });
}

/** Extracts "session=<token>" from a Set-Cookie header, for sending back. */
export function sessionCookieFrom(setCookie: string[] | string | undefined): string {
  const cookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const session = cookies.find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  if (!session) throw new Error('No session cookie was set');
  return session.split(';')[0]!;
}
