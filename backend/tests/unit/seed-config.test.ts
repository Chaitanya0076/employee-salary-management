import { describe, expect, it } from 'vitest';
import { parseSeedEnv } from '../../prisma/seed/config.js';

const base = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  SEED_HR_EMAIL: ' HR.Manager@ACME.example ',
  SEED_HR_PASSWORD: 'a-strong-production-password',
};

describe('parseSeedEnv', () => {
  it('normalises the email and allows local seeding without opt-in', () => {
    expect(parseSeedEnv(base)).toMatchObject({
      NODE_ENV: 'development',
      SEED_HR_EMAIL: 'hr.manager@acme.example',
      SEED_ALLOW_PRODUCTION: false,
    });
  });

  it('refuses to seed production without an explicit opt-in', () => {
    expect(() => parseSeedEnv({ ...base, NODE_ENV: 'production' })).toThrow(
      /SEED_ALLOW_PRODUCTION=true/,
    );
  });

  it('refuses the example password in production, even with the opt-in', () => {
    expect(() =>
      parseSeedEnv({
        ...base,
        NODE_ENV: 'production',
        SEED_ALLOW_PRODUCTION: 'true',
        SEED_HR_PASSWORD: 'ChangeMe-Local-Dev-1',
      }),
    ).toThrow(/example value/);
  });

  it('accepts a production seed with opt-in and a real password', () => {
    expect(
      parseSeedEnv({ ...base, NODE_ENV: 'production', SEED_ALLOW_PRODUCTION: 'true' })
        .SEED_ALLOW_PRODUCTION,
    ).toBe(true);
  });

  it('requires a password of at least 12 characters', () => {
    expect(() => parseSeedEnv({ ...base, SEED_HR_PASSWORD: 'short' })).toThrow(/at least 12/);
  });
});
