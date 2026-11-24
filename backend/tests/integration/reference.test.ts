import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { disconnectTestPrisma, loggedInAgent, resetDatabase } from './fixtures.js';

type Agent = Awaited<ReturnType<typeof loggedInAgent>>;
let api: Agent;

// Sessions live in the in-memory auth service, so one login per file survives database resets.
beforeAll(async () => {
  api = await loggedInAgent();
});

beforeEach(resetDatabase);

afterAll(disconnectTestPrisma);

describe('reference data', () => {
  it('lists countries with their currency, sorted by name', async () => {
    const res = await api.get('/api/countries').expect(200);

    expect(res.body.data.map((c: { code: string }) => c.code)).toEqual([
      'CA',
      'DE',
      'IN',
      'SG',
      'GB',
      'US',
    ]);
    expect(res.body.data[0]).toEqual({ code: 'CA', name: 'Canada', currency: 'CAD' });
  });

  it('lists departments sorted by name', async () => {
    const res = await api.get('/api/departments').expect(200);

    expect(res.body.data).toHaveLength(8);
    expect(res.body.data[0]).toEqual({ id: 3, name: 'Customer Support' });
  });

  it('lists FX rates as exact decimal strings', async () => {
    const res = await api.get('/api/fx-rates').expect(200);

    expect(res.body.data.find((r: { currency: string }) => r.currency === 'GBP')).toEqual({
      currency: 'GBP',
      rateToUsd: '1.27000000',
      updatedAt: expect.any(String),
    });
  });
});

describe('PUT /api/fx-rates/:currency', () => {
  it('updates a rate, and USD figures use it immediately', async () => {
    const res = await api.put('/api/fx-rates/gbp').send({ rateToUsd: '1.3' }).expect(200);
    expect(res.body).toMatchObject({ currency: 'GBP', rateToUsd: '1.30000000' });

    const bob = await api.get('/api/employees?q=bob').expect(200);
    expect(bob.body.data[0].pay).toMatchObject({ total: '52000.00', totalUsd: '67600.00' });
  });

  it('keeps the reporting currency fixed at 1', async () => {
    const res = await api.put('/api/fx-rates/USD').send({ rateToUsd: 2 }).expect(400);
    expect(res.body.error.details[0].path).toBe('params.currency');
  });

  it('returns 404 for an unknown currency', async () => {
    await api.put('/api/fx-rates/JPY').send({ rateToUsd: 0.0067 }).expect(404);
  });

  it.each([['0'], ['-1'], ['abc'], ['1.123456789']])('rejects the rate %s', async (rate) => {
    await api.put('/api/fx-rates/GBP').send({ rateToUsd: rate }).expect(400);
  });
});
