import type { RequestHandler } from 'express';
import { UnauthorizedError } from '../../shared/errors/index.js';
import type { AuthService } from './auth.service.js';
import { SESSION_COOKIE } from './session-cookie.js';

/** Rejects requests without a valid session cookie; otherwise sets req.user. */
export function requireAuth(service: Pick<AuthService, 'authenticate'>): RequestHandler {
  return async (req, _res, next) => {
    const token: unknown = req.cookies?.[SESSION_COOKIE];
    if (typeof token !== 'string' || token.length === 0) {
      next(new UnauthorizedError());
      return;
    }
    try {
      req.user = await service.authenticate(token);
      next();
    } catch (err) {
      next(err);
    }
  };
}
