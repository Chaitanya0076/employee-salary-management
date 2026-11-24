import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { SESSION_COOKIE, requireAuth, type AuthUser } from '../../src/modules/auth/index.js';
import { UnauthorizedError } from '../../src/shared/errors/index.js';

const user: AuthUser = { id: 1, email: 'hr@acme.example', name: 'HR', role: 'HR_MANAGER' };

async function run(
  cookies: Record<string, string> | undefined,
  authenticate = vi.fn(async () => user),
) {
  const req = { cookies } as Request;
  const next = vi.fn();
  await requireAuth({ authenticate })(req, {} as Response, next as NextFunction);
  return { req, next, authenticate, error: next.mock.calls[0]?.[0] as unknown };
}

describe('requireAuth', () => {
  it('attaches the user and continues for a valid session cookie', async () => {
    const { req, next, authenticate } = await run({ [SESSION_COOKIE]: 'valid-token' });

    expect(authenticate).toHaveBeenCalledWith('valid-token');
    expect(req.user).toEqual(user);
    expect(next).toHaveBeenCalledWith();
  });

  it.each([
    ['no cookies at all', undefined],
    ['no session cookie', { other: 'x' }],
    ['an empty session cookie', { [SESSION_COOKIE]: '' }],
  ])('responds 401 when there is %s', async (_label, cookies) => {
    const { error, authenticate } = await run(cookies);

    expect(error).toBeInstanceOf(UnauthorizedError);
    expect(authenticate).not.toHaveBeenCalled();
  });

  it('passes on the error when the session is rejected', async () => {
    const rejection = new UnauthorizedError('Session is invalid or has expired');
    const { req, error } = await run(
      { [SESSION_COOKIE]: 'expired' },
      vi.fn(async () => {
        throw rejection;
      }),
    );

    expect(error).toBe(rejection);
    expect(req.user).toBeUndefined();
  });
});
