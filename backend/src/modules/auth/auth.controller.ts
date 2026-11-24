import type { Request, Response } from 'express';
import type { AuthService } from './auth.service.js';
import type { LoginBody } from './auth.schema.js';
import {
  SESSION_COOKIE,
  sessionCookieOptions,
  type SessionCookieConfig,
} from './session-cookie.js';

export function createAuthController(service: AuthService, cookie: SessionCookieConfig) {
  const options = sessionCookieOptions(cookie);

  return {
    async login(req: Request, res: Response) {
      const { email, password } = req.body as LoginBody;
      const { user, token, expiresAt } = await service.login(email, password);
      res.cookie(SESSION_COOKIE, token, { ...options, expires: expiresAt });
      res.json({ user });
    },

    logout(_req: Request, res: Response) {
      res.clearCookie(SESSION_COOKIE, options);
      res.status(204).end();
    },

    me(req: Request, res: Response) {
      res.json({ user: req.user });
    },
  };
}
