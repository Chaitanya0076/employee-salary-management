import type { CookieOptions } from 'express';

export const SESSION_COOKIE = 'session';

export interface SessionCookieConfig {
  /** true in production so the cookie is only sent over HTTPS. */
  secure: boolean;
}

/**
 * httpOnly: unreadable from JS (XSS can't steal it).
 * SameSite=Lax: not sent on cross-site POST/PATCH/PUT, which blocks CSRF on mutations.
 * Path=/api: only sent to the API.
 */
export function sessionCookieOptions({ secure }: SessionCookieConfig): CookieOptions {
  return { httpOnly: true, sameSite: 'lax', secure, path: '/api' };
}
