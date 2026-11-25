import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  TODAY,
  buildIntegrationApp,
  disconnectTestPrisma,
  loggedInAgent,
  resetDatabase,
  testPrisma,
} from './fixtures.js';

type Agent = Awaited<ReturnType<typeof loggedInAgent>>;
let api: Agent;

beforeAll(async () => {
  api = await loggedInAgent();
});

beforeEach(resetDatabase);

afterAll(disconnectTestPrisma);

// Bob Jones (id 2, GB): one open record since 2021-03-01, BASE 50,000 + ALLOWANCE 2,000 GBP.
const BOB = 2;
const raise = {
  effectiveFrom: '2026-04-01',
  components: [
    { type: 'BASE', amount: '55000' },
    { type: 'ALLOWANCE', amount: 2000 },
  ],
  reason: 'Annual review',
};

const recordsOf = (employeeId: number) =>
  testPrisma().compensation.findMany({ where: { employeeId }, orderBy: { effectiveFrom: 'asc' } });

describe('GET /api/employees/:id/compensation', () => {
  it('returns the current record and full history, newest first', async () => {
    const res = await api.get('/api/employees/1/compensation').expect(200);

    expect(res.body.employeeId).toBe(1);
    expect(res.body.currency).toBe('USD');
    expect(res.body.history.map((r: { effectiveFrom: string }) => r.effectiveFrom)).toEqual([
      '2023-04-01',
      '2020-01-15',
    ]);
    expect(res.body.current).toEqual(res.body.history[0]);
    expect(res.body.history[1]).toMatchObject({
      effectiveFrom: '2020-01-15',
      effectiveTo: '2023-04-01',
      reason: 'New hire',
      components: [{ type: 'BASE', amount: '100000.00' }],
      total: '100000.00',
      totalUsd: '100000.00',
    });
  });

  it('includes USD equivalents for non-USD pay', async () => {
    const res = await api.get(`/api/employees/${BOB}/compensation`).expect(200);

    expect(res.body.current).toMatchObject({
      currency: 'GBP',
      total: '52000.00',
      totalUsd: '66040.00',
    });
  });

  it('returns 404 for an unknown employee and 401 without a session', async () => {
    await api.get('/api/employees/9999/compensation').expect(404);
    await request(buildIntegrationApp()).get('/api/employees/1/compensation').expect(401);
  });
});

describe('POST /api/employees/:id/compensation', () => {
  it('closes the current record and opens the new one in a single change', async () => {
    const res = await api.post(`/api/employees/${BOB}/compensation`).send(raise).expect(201);

    expect(res.headers['location']).toBe(`/api/employees/${BOB}/compensation`);
    expect(res.body.compensation).toMatchObject({
      currency: 'GBP',
      effectiveFrom: '2026-04-01',
      effectiveTo: null,
      reason: 'Annual review',
      components: [
        { type: 'BASE', amount: '55000.00' },
        { type: 'ALLOWANCE', amount: '2000.00' },
      ],
      base: '55000.00',
      total: '57000.00',
    });
    expect(res.body.previous).toMatchObject({
      effectiveFrom: '2021-03-01',
      effectiveTo: '2026-04-01',
    });
    expect(res.body.change).toEqual({
      base: { amount: '5000.00', percent: '10.00' },
      total: { amount: '5000.00', percent: '9.62' },
    });

    const rows = await recordsOf(BOB);
    expect(
      rows.map((r) => [
        r.effectiveFrom.toISOString().slice(0, 10),
        r.effectiveTo?.toISOString().slice(0, 10) ?? null,
      ]),
    ).toEqual([
      ['2021-03-01', '2026-04-01'],
      ['2026-04-01', null],
    ]);

    // The list and detail now show the new current pay.
    const list = await api.get('/api/employees?q=bob').expect(200);
    expect(list.body.data[0].pay).toMatchObject({ base: '55000.00', total: '57000.00' });
    const history = await api.get(`/api/employees/${BOB}/compensation`).expect(200);
    expect(history.body.history).toHaveLength(2);
  });

  it('accepts a change effective today', async () => {
    await api
      .post(`/api/employees/${BOB}/compensation`)
      .send({ ...raise, effectiveFrom: TODAY })
      .expect(201);
  });

  it.each([
    ['starts on the current start date', { effectiveFrom: '2021-03-01' }, 'body.effectiveFrom'],
    ['starts before the current record', { effectiveFrom: '2020-01-01' }, 'body.effectiveFrom'],
    ['is in the future', { effectiveFrom: '2026-06-16' }, 'body.effectiveFrom'],
    ['has no BASE', { components: [{ type: 'BONUS', amount: 100 }] }, 'body.components'],
    [
      'repeats a type',
      {
        components: [
          { type: 'BASE', amount: 1 },
          { type: 'BASE', amount: 2 },
        ],
      },
      'body.components.1.type',
    ],
    [
      'has a non-positive amount',
      { components: [{ type: 'BASE', amount: 0 }] },
      'body.components.0.amount',
    ],
    [
      'is identical to current pay',
      {
        components: [
          { type: 'ALLOWANCE', amount: 2000 },
          { type: 'BASE', amount: 50000 },
        ],
      },
      'body.components',
    ],
    ['has a malformed date', { effectiveFrom: '01/04/2026' }, 'body.effectiveFrom'],
    ['sends a currency', { currency: 'USD' }, 'body'],
  ])('rejects a change that %s, leaving history untouched', async (_label, override, path) => {
    const res = await api
      .post(`/api/employees/${BOB}/compensation`)
      .send({ ...raise, ...override })
      .expect(400);

    expect(res.body.error.details.map((d: { path: string }) => d.path)).toContain(path);
    expect(await recordsOf(BOB)).toHaveLength(1);
  });

  it('rejects a change for an inactive employee with 409', async () => {
    // Dieter Müller (id 4) is INACTIVE.
    const res = await api.post('/api/employees/4/compensation').send(raise).expect(409);

    expect(res.body.error.message).toBe('Pay cannot be changed for an inactive employee');
    expect(await recordsOf(4)).toHaveLength(1);
  });

  it('returns 404 for an unknown employee', async () => {
    await api.post('/api/employees/9999/compensation').send(raise).expect(404);
  });

  it('records exactly one change when the same request is submitted twice concurrently', async () => {
    const statuses = (
      await Promise.all([
        api.post(`/api/employees/${BOB}/compensation`).send(raise),
        api.post(`/api/employees/${BOB}/compensation`).send(raise),
        api.post(`/api/employees/${BOB}/compensation`).send(raise),
      ])
    )
      .map((res) => res.status)
      .sort();

    // One wins. A request that waited on the row lock gets 409 (its current record was
    // closed); one that started after the commit gets 400 (the date is no longer after
    // the current record). Either way nothing is written twice.
    expect(statuses[0]).toBe(201);
    for (const status of statuses.slice(1)) expect([400, 409]).toContain(status);
    const rows = await recordsOf(BOB);
    expect(rows).toHaveLength(2);
    expect(rows.filter((r) => r.effectiveTo === null)).toHaveLength(1);
  });
});
