import type { AuthUser } from '../modules/auth/auth.types.js';

declare module 'express-serve-static-core' {
  interface Request {
    /** Set by requireAuth for authenticated requests. */
    user?: AuthUser;
  }
}
