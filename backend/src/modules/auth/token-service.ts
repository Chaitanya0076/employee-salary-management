import { SignJWT, jwtVerify } from 'jose';
import type { Role, TokenClaims } from './auth.types.js';

export interface TokenService {
  /** Signed token plus its absolute expiry (used for the cookie lifetime). */
  sign(claims: TokenClaims): Promise<{ token: string; expiresAt: Date }>;
  /** Throws if the token is malformed, tampered with, or expired. */
  verify(token: string): Promise<TokenClaims>;
}

export interface JwtOptions {
  secret: string;
  ttlMinutes: number;
  /** Injected for deterministic tests. */
  now?: () => Date;
}

const ISSUER = 'salary-management-api';
const AUDIENCE = 'salary-management-web';
const ALGORITHM = 'HS256';

export function createJwtTokenService({
  secret,
  ttlMinutes,
  now = () => new Date(),
}: JwtOptions): TokenService {
  const key = new TextEncoder().encode(secret);

  return {
    async sign({ userId, role }) {
      const issuedAt = Math.floor(now().getTime() / 1000);
      const expiresAtSeconds = issuedAt + ttlMinutes * 60;
      const token = await new SignJWT({ role })
        .setProtectedHeader({ alg: ALGORITHM })
        .setSubject(String(userId))
        .setIssuer(ISSUER)
        .setAudience(AUDIENCE)
        .setIssuedAt(issuedAt)
        .setExpirationTime(expiresAtSeconds)
        .sign(key);
      return { token, expiresAt: new Date(expiresAtSeconds * 1000) };
    },

    async verify(token) {
      const { payload } = await jwtVerify(token, key, {
        algorithms: [ALGORITHM],
        issuer: ISSUER,
        audience: AUDIENCE,
        currentDate: now(),
      });
      const userId = Number(payload.sub);
      if (!Number.isInteger(userId) || userId <= 0) throw new Error('Invalid subject claim');
      return { userId, role: payload['role'] as Role };
    },
  };
}
