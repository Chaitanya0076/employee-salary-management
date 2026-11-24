import { describe, expect, it } from 'vitest';
import { createJwtTokenService } from '../../src/modules/auth/index.js';

const SECRET = 'unit-test-secret-that-is-at-least-32-chars';
const START = new Date('2026-03-01T09:00:00Z');

function serviceAt(clock: { now: Date }, secret = SECRET) {
  return createJwtTokenService({ secret, ttlMinutes: 480, now: () => clock.now });
}

describe('JWT token service', () => {
  it('round-trips the claims and reports the expiry', async () => {
    const clock = { now: START };
    const tokens = serviceAt(clock);

    const { token, expiresAt } = await tokens.sign({ userId: 7, role: 'HR_MANAGER' });

    expect(expiresAt).toEqual(new Date('2026-03-01T17:00:00Z'));
    await expect(tokens.verify(token)).resolves.toEqual({ userId: 7, role: 'HR_MANAGER' });
  });

  it('is deterministic for a fixed clock', async () => {
    const tokens = serviceAt({ now: START });

    const a = await tokens.sign({ userId: 7, role: 'HR_MANAGER' });
    const b = await tokens.sign({ userId: 7, role: 'HR_MANAGER' });

    expect(a.token).toBe(b.token);
  });

  it('accepts a token just before expiry and rejects it after', async () => {
    const clock = { now: START };
    const tokens = serviceAt(clock);
    const { token } = await tokens.sign({ userId: 7, role: 'HR_MANAGER' });

    clock.now = new Date('2026-03-01T16:59:59Z');
    await expect(tokens.verify(token)).resolves.toMatchObject({ userId: 7 });

    clock.now = new Date('2026-03-01T17:00:01Z');
    await expect(tokens.verify(token)).rejects.toThrow();
  });

  it('rejects a tampered token', async () => {
    const tokens = serviceAt({ now: START });
    const { token } = await tokens.sign({ userId: 7, role: 'HR_MANAGER' });
    const [header, payload, signature] = token.split('.');
    const forged = Buffer.from(
      JSON.stringify({ ...JSON.parse(Buffer.from(payload!, 'base64url').toString()), sub: '1' }),
    ).toString('base64url');

    await expect(tokens.verify(`${header}.${forged}.${signature}`)).rejects.toThrow();
  });

  it('rejects a token signed with a different secret', async () => {
    const clock = { now: START };
    const { token } = await serviceAt(clock, 'another-secret-that-is-at-least-32-chars').sign({
      userId: 7,
      role: 'HR_MANAGER',
    });

    await expect(serviceAt(clock).verify(token)).rejects.toThrow();
  });
});
