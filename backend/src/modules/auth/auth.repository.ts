import type { PrismaClient } from '../../shared/db/index.js';
import type { AuthUserRecord } from './auth.types.js';

export interface AuthRepository {
  findByEmail(email: string): Promise<AuthUserRecord | null>;
  findById(id: number): Promise<AuthUserRecord | null>;
}

const SELECT = { id: true, email: true, name: true, role: true, passwordHash: true } as const;

export function createAuthRepository(prisma: PrismaClient): AuthRepository {
  return {
    findByEmail: (email) => prisma.user.findUnique({ where: { email }, select: SELECT }),
    findById: (id) => prisma.user.findUnique({ where: { id }, select: SELECT }),
  };
}
