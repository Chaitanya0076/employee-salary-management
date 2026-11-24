import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { TooManyRequestsError } from '../../shared/errors/index.js';
import { validate } from '../../shared/middleware/index.js';
import { createAuthController } from './auth.controller.js';
import { LoginBody } from './auth.schema.js';
import type { AuthService } from './auth.service.js';
import type { SessionCookieConfig } from './session-cookie.js';

export interface LoginRateLimit {
  /** Failed attempts allowed per client IP within the window. */
  limit: number;
  windowMs: number;
}

export const DEFAULT_LOGIN_RATE_LIMIT: LoginRateLimit = { limit: 10, windowMs: 15 * 60 * 1000 };

export interface AuthRoutesDeps {
  service: AuthService;
  cookie: SessionCookieConfig;
  loginRateLimit?: LoginRateLimit;
}

/** Public: login and logout. Mounted before the auth guard. */
export function publicAuthRoutes({
  service,
  cookie,
  loginRateLimit = DEFAULT_LOGIN_RATE_LIMIT,
}: AuthRoutesDeps): Router {
  const controller = createAuthController(service, cookie);
  const router = Router();

  const loginLimiter = rateLimit({
    windowMs: loginRateLimit.windowMs,
    limit: loginRateLimit.limit,
    // Only failed attempts count, so a legitimate user is never locked out by logging in.
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, _res, next) =>
      next(new TooManyRequestsError('Too many login attempts, please try again later')),
  });

  router.post('/login', loginLimiter, validate({ body: LoginBody }), controller.login);
  // Logout only clears the cookie, so it stays public: an expired session can still log out.
  router.post('/logout', controller.logout);
  return router;
}

/** Protected: mounted after the auth guard. */
export function protectedAuthRoutes({ service, cookie }: AuthRoutesDeps): Router {
  const controller = createAuthController(service, cookie);
  const router = Router();
  router.get('/me', controller.me);
  return router;
}
