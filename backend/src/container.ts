/**
 * Composition root: the only place that knows how repositories and services
 * are wired together. server.ts and the database-backed tests both use it.
 */
import {
  createAnalyticsRepository,
  createAnalyticsService,
  type AnalyticsService,
} from './modules/analytics/index.js';
import {
  createAuthRepository,
  createAuthService,
  createBcryptPasswordHasher,
  createJwtTokenService,
  type AuthService,
  type PasswordHasher,
} from './modules/auth/index.js';
import {
  createCompensationRepository,
  createCompensationService,
  type CompensationService,
} from './modules/compensation/index.js';
import {
  createEmployeeRepository,
  createEmployeesService,
  type EmployeesService,
} from './modules/employees/index.js';
import {
  createReferenceRepository,
  createReferenceService,
  type ReferenceService,
} from './modules/reference/index.js';
import type { PrismaClient } from './shared/db/index.js';
import { systemClock, type Clock } from './shared/utils/index.js';

export interface AppServices {
  auth: AuthService;
  reference: ReferenceService;
  employees: EmployeesService;
  compensation: CompensationService;
  analytics: AnalyticsService;
}

export interface ServiceConfig {
  prisma: PrismaClient;
  jwt: { secret: string; ttlMinutes: number };
  clock?: Clock;
  passwords?: PasswordHasher;
}

export function createServices({
  prisma,
  jwt,
  clock = systemClock,
  passwords,
}: ServiceConfig): AppServices {
  const referenceRepository = createReferenceRepository(prisma);

  return {
    auth: createAuthService({
      users: createAuthRepository(prisma),
      passwords: passwords ?? createBcryptPasswordHasher(),
      tokens: createJwtTokenService(jwt),
    }),
    reference: createReferenceService(referenceRepository),
    employees: createEmployeesService({
      employees: createEmployeeRepository(prisma),
      reference: referenceRepository,
      clock,
    }),
    compensation: createCompensationService({
      compensation: createCompensationRepository(prisma),
      clock,
    }),
    analytics: createAnalyticsService({
      analytics: createAnalyticsRepository(prisma),
      reference: referenceRepository,
    }),
  };
}
