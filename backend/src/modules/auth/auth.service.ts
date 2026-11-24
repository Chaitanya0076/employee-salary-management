import { UnauthorizedError } from '../../shared/errors/index.js';
import type { AuthRepository } from './auth.repository.js';
import type { AuthUser, AuthUserRecord } from './auth.types.js';
import type { PasswordHasher } from './password-hasher.js';
import type { TokenService } from './token-service.js';

export const INVALID_CREDENTIALS_MESSAGE = 'Invalid email or password';
export const INVALID_SESSION_MESSAGE = 'Session is invalid or has expired';

export interface AuthService {
  login(
    email: string,
    password: string,
  ): Promise<{ user: AuthUser; token: string; expiresAt: Date }>;
  /** Resolves the user behind a session token, or throws UnauthorizedError. */
  authenticate(token: string): Promise<AuthUser>;
}

export interface AuthServiceDeps {
  users: AuthRepository;
  passwords: PasswordHasher;
  tokens: TokenService;
}

function toAuthUser({ id, email, name, role }: AuthUserRecord): AuthUser {
  return { id, email, name, role };
}

export function createAuthService({ users, passwords, tokens }: AuthServiceDeps): AuthService {
  return {
    async login(email, password) {
      const user = await users.findByEmail(email.trim().toLowerCase());
      // Always run one bcrypt comparison so unknown emails and wrong passwords
      // are indistinguishable by both message and timing.
      const matches = await passwords.verify(password, user?.passwordHash ?? passwords.dummyHash);
      if (!user || !matches) throw new UnauthorizedError(INVALID_CREDENTIALS_MESSAGE);

      const { token, expiresAt } = await tokens.sign({ userId: user.id, role: user.role });
      return { user: toAuthUser(user), token, expiresAt };
    },

    async authenticate(token) {
      let userId: number;
      try {
        ({ userId } = await tokens.verify(token));
      } catch {
        throw new UnauthorizedError(INVALID_SESSION_MESSAGE);
      }
      // Re-read the user so a deleted account loses access immediately.
      const user = await users.findById(userId);
      if (!user) throw new UnauthorizedError(INVALID_SESSION_MESSAGE);
      return toAuthUser(user);
    },
  };
}
