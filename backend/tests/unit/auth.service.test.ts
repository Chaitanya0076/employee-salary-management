import { describe, expect, it, vi } from 'vitest';
import {
  INVALID_CREDENTIALS_MESSAGE,
  INVALID_SESSION_MESSAGE,
  createAuthService,
  type PasswordHasher,
  type TokenService,
} from '../../src/modules/auth/index.js';
import { UnauthorizedError } from '../../src/shared/errors/index.js';
import { hrUser, inMemoryUsers } from '../helpers/auth.js';

const EXPIRES_AT = new Date('2026-01-01T08:00:00Z');

function setup() {
  // Fakes: plain-text "hashing" and a token that just encodes the user id.
  const passwords: PasswordHasher = {
    hash: async (plain) => `hashed:${plain}`,
    verify: vi.fn(async (plain: string, hash: string) => hash === `hashed:${plain}`),
    dummyHash: 'hashed:<dummy>',
  };
  const tokens: TokenService = {
    sign: vi.fn(async ({ userId }) => ({ token: `token-for-${userId}`, expiresAt: EXPIRES_AT })),
    verify: async (token) => {
      const match = /^token-for-(\d+)$/.exec(token);
      if (!match) throw new Error('bad token');
      return { userId: Number(match[1]), role: 'HR_MANAGER' };
    },
  };
  const user = { ...hrUser, passwordHash: 'hashed:secret-password' };
  const service = createAuthService({ users: inMemoryUsers([user]), passwords, tokens });
  return { service, passwords, tokens };
}

describe('AuthService.login', () => {
  it('returns the public user and a signed token for valid credentials', async () => {
    const { service, tokens } = setup();

    const result = await service.login('hr.manager@acme.example', 'secret-password');

    expect(result).toEqual({
      user: { id: 1, email: 'hr.manager@acme.example', name: 'HR Manager', role: 'HR_MANAGER' },
      token: 'token-for-1',
      expiresAt: EXPIRES_AT,
    });
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(tokens.sign).toHaveBeenCalledWith({ userId: 1, role: 'HR_MANAGER' });
  });

  it('matches the email case-insensitively and ignores surrounding spaces', async () => {
    const { service } = setup();

    await expect(
      service.login('  HR.Manager@ACME.example ', 'secret-password'),
    ).resolves.toMatchObject({
      user: { id: 1 },
    });
  });

  it('rejects a wrong password with the generic message', async () => {
    const { service, tokens } = setup();

    const error = await service.login('hr.manager@acme.example', 'wrong').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(UnauthorizedError);
    expect((error as Error).message).toBe(INVALID_CREDENTIALS_MESSAGE);
    expect(tokens.sign).not.toHaveBeenCalled();
  });

  it('rejects an unknown email with the same message, still running one hash comparison', async () => {
    const { service, passwords } = setup();

    const error = await service
      .login('nobody@acme.example', 'secret-password')
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(UnauthorizedError);
    expect((error as Error).message).toBe(INVALID_CREDENTIALS_MESSAGE);
    expect(passwords.verify).toHaveBeenCalledExactlyOnceWith('secret-password', 'hashed:<dummy>');
  });
});

describe('AuthService.authenticate', () => {
  it('returns the user for a valid token', async () => {
    const { service } = setup();

    await expect(service.authenticate('token-for-1')).resolves.toEqual({
      id: 1,
      email: 'hr.manager@acme.example',
      name: 'HR Manager',
      role: 'HR_MANAGER',
    });
  });

  it('rejects an invalid token', async () => {
    const { service } = setup();

    await expect(service.authenticate('garbage')).rejects.toThrow(
      new UnauthorizedError(INVALID_SESSION_MESSAGE),
    );
  });

  it('rejects a valid token whose user no longer exists', async () => {
    const { service } = setup();

    await expect(service.authenticate('token-for-99')).rejects.toThrow(INVALID_SESSION_MESSAGE);
  });
});
