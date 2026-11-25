import { describe, expect, it } from 'vitest';
import { loadEnv } from '../../src/config/env.js';

const DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
const JWT_SECRET = 'a-test-secret-that-is-at-least-32-characters';
const base = { DATABASE_URL, JWT_SECRET };

describe('loadEnv', () => {
  it('applies defaults and coerces types', () => {
    expect(loadEnv(base)).toEqual({
      NODE_ENV: 'development',
      PORT: 4000,
      DATABASE_URL,
      JWT_SECRET,
      JWT_TTL_MINUTES: 480,
      TRUST_PROXY: 0,
      LOG_FORWARDED_FOR: false,
    });
    expect(loadEnv({ ...base, LOG_FORWARDED_FOR: 'true' }).LOG_FORWARDED_FOR).toBe(true);
    expect(loadEnv({ ...base, PORT: '8080', TRUST_PROXY: '1' })).toMatchObject({
      PORT: 8080,
      TRUST_PROXY: 1,
    });
  });

  it('fails fast when DATABASE_URL is missing', () => {
    expect(() => loadEnv({ JWT_SECRET })).toThrow(/DATABASE_URL/);
  });

  it('rejects a non-PostgreSQL database URL', () => {
    expect(() => loadEnv({ ...base, DATABASE_URL: 'mysql://localhost/db' })).toThrow(
      /DATABASE_URL/,
    );
  });

  it('rejects an invalid port', () => {
    expect(() => loadEnv({ ...base, PORT: '70000' })).toThrow(/PORT/);
  });

  it('requires a JWT secret of at least 32 characters', () => {
    expect(() => loadEnv({ DATABASE_URL })).toThrow(/JWT_SECRET/);
    expect(() => loadEnv({ DATABASE_URL, JWT_SECRET: 'too-short' })).toThrow(/at least 32/);
  });

  it('refuses the example placeholder secret in production', () => {
    const placeholder = 'local-dev-only-secret-change-me-0123456789abcdef';
    expect(() =>
      loadEnv({ DATABASE_URL, JWT_SECRET: placeholder, NODE_ENV: 'production' }),
    ).toThrow(/placeholder/);
    expect(loadEnv({ DATABASE_URL, JWT_SECRET: placeholder }).JWT_SECRET).toBe(placeholder);
  });
});
