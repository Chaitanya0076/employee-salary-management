import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  buildIntegrationApp,
  disconnectTestPrisma,
  loggedInAgent,
  resetDatabase,
} from './fixtures.js';

/**
 * Expected values are computed by hand from the fixtures. Dieter Müller (DE)
 * is INACTIVE and must never be counted. Active employees' current pay:
 *
 * | Employee | Country | Dept        | Level | Base (local) | Base USD | Total USD | Hired |
 * | Alice    | US      | Engineering | L3    | 120,000 USD  | 120,000  | 132,000   | 2020  |
 * | Bob      | GB      | Sales       | L2    | 50,000 GBP   | 63,500   | 66,040    | 2021  |
 * | Chitra   | IN      | Engineering | L2    | 1,500,000 INR| 18,000   | 19,800    | 2022  |
 * | Emma     | US      | Product     | L5    | 200,000 USD  | 200,000  | 240,000   | 2018  |
 *
 * Alice's closed 100,000 record is history and must not be counted either.
 */
type Agent = Awaited<ReturnType<typeof loggedInAgent>>;
let api: Agent;

beforeAll(async () => {
  await resetDatabase();
  api = await loggedInAgent();
});

afterAll(disconnectTestPrisma);

const get = async (path: string) => (await api.get(`/api/analytics/${path}`).expect(200)).body;

describe('GET /api/analytics/summary', () => {
  it('totals pay in USD with average and an even-count median', async () => {
    // Totals sorted: 19,800 / 66,040 / 132,000 / 240,000 -> median (66,040 + 132,000) / 2.
    expect(await get('summary')).toEqual({
      headcount: 4,
      currency: 'USD',
      totalPay: '457840.00',
      averagePay: '114460.00',
      medianPay: '99020.00',
    });
  });

  it('applies country and department filters', async () => {
    expect(await get('summary?country=us')).toMatchObject({
      headcount: 2,
      totalPay: '372000.00',
      medianPay: '186000.00',
    });
    expect(await get('summary?department=1')).toMatchObject({
      headcount: 2,
      totalPay: '151800.00',
      averagePay: '75900.00',
    });
  });

  it('excludes inactive employees, returning an empty summary', async () => {
    expect(await get('summary?country=DE')).toEqual({
      headcount: 0,
      currency: 'USD',
      totalPay: '0.00',
      averagePay: null,
      medianPay: null,
    });
  });

  it('requires a session and rejects unknown filters', async () => {
    await request(buildIntegrationApp()).get('/api/analytics/summary').expect(401);
    const res = await api.get('/api/analytics/summary?country=FR').expect(400);
    expect(res.body.error.details[0].path).toBe('query.country');
  });
});

describe('GET /api/analytics/by-country', () => {
  it('breaks pay down per country in local currency and USD, largest spend first', async () => {
    const { data } = await get('by-country');

    expect(data).toEqual([
      {
        country: { code: 'US', name: 'United States' },
        currency: 'USD',
        headcount: 2,
        totalPay: '372000.00',
        totalPayUsd: '372000.00',
        base: { average: '160000.00', median: '160000.00', min: '120000.00', max: '200000.00' },
      },
      {
        country: { code: 'GB', name: 'United Kingdom' },
        currency: 'GBP',
        headcount: 1,
        totalPay: '52000.00',
        totalPayUsd: '66040.00',
        base: { average: '50000.00', median: '50000.00', min: '50000.00', max: '50000.00' },
      },
      {
        country: { code: 'IN', name: 'India' },
        currency: 'INR',
        headcount: 1,
        totalPay: '1650000.00',
        totalPayUsd: '19800.00',
        base: { average: '1500000.00', median: '1500000.00', min: '1500000.00', max: '1500000.00' },
      },
    ]);
  });

  it('filters by department', async () => {
    const { data } = await get('by-country?department=1');
    expect(data.map((r: { country: { code: string } }) => r.country.code)).toEqual(['US', 'IN']);
  });
});

describe('GET /api/analytics/by-department', () => {
  it('compares departments in USD across currencies', async () => {
    expect((await get('by-department')).data).toEqual([
      {
        department: { id: 6, name: 'Product' },
        headcount: 1,
        totalPayUsd: '240000.00',
        base: { average: '200000.00', median: '200000.00' },
      },
      {
        department: { id: 1, name: 'Engineering' },
        headcount: 2,
        totalPayUsd: '151800.00',
        base: { average: '69000.00', median: '69000.00' },
      },
      {
        department: { id: 2, name: 'Sales' },
        headcount: 1,
        totalPayUsd: '66040.00',
        base: { average: '63500.00', median: '63500.00' },
      },
    ]);
  });
});

describe('GET /api/analytics/by-level', () => {
  it('uses USD across countries', async () => {
    expect(await get('by-level')).toEqual({
      currency: 'USD',
      data: [
        {
          level: 'L2',
          headcount: 2,
          base: { average: '40750.00', median: '40750.00', min: '18000.00', max: '63500.00' },
        },
        {
          level: 'L3',
          headcount: 1,
          base: { average: '120000.00', median: '120000.00', min: '120000.00', max: '120000.00' },
        },
        {
          level: 'L5',
          headcount: 1,
          base: { average: '200000.00', median: '200000.00', min: '200000.00', max: '200000.00' },
        },
      ],
    });
  });

  it('uses the local currency within one country', async () => {
    const result = await get('by-level?country=IN');
    expect(result).toEqual({
      currency: 'INR',
      data: [
        {
          level: 'L2',
          headcount: 1,
          base: {
            average: '1500000.00',
            median: '1500000.00',
            min: '1500000.00',
            max: '1500000.00',
          },
        },
      ],
    });
  });
});

describe('GET /api/analytics/distribution', () => {
  it('buckets base pay (USD) with readable edges, the maximum counted in the last bucket', async () => {
    // USD bases: 18,000 / 63,500 / 120,000 / 200,000.
    expect(await get('distribution?buckets=4')).toEqual({
      currency: 'USD',
      data: [
        { from: '0.00', to: '50000.00', count: 1 },
        { from: '50000.00', to: '100000.00', count: 1 },
        { from: '100000.00', to: '150000.00', count: 1 },
        { from: '150000.00', to: '200000.00', count: 1 },
      ],
    });
  });

  it('uses local currency within a country and filters by level', async () => {
    expect(await get('distribution?country=US&level=L5')).toEqual({
      currency: 'USD',
      data: [{ from: '200000.00', to: '220000.00', count: 1 }],
    });
  });

  it('returns no buckets when nobody matches', async () => {
    expect(await get('distribution?country=DE')).toEqual({ currency: 'EUR', data: [] });
  });
});

describe('GET /api/analytics/headcount-trend', () => {
  it('counts active hires per year, filling gaps (the 2019 hire is inactive)', async () => {
    expect((await get('headcount-trend')).data).toEqual([
      { year: 2018, hires: 1, cumulative: 1 },
      { year: 2019, hires: 0, cumulative: 1 },
      { year: 2020, hires: 1, cumulative: 2 },
      { year: 2021, hires: 1, cumulative: 3 },
      { year: 2022, hires: 1, cumulative: 4 },
    ]);
  });

  it('filters by country', async () => {
    expect((await get('headcount-trend?country=US')).data).toEqual([
      { year: 2018, hires: 1, cumulative: 1 },
      { year: 2019, hires: 0, cumulative: 1 },
      { year: 2020, hires: 1, cumulative: 2 },
    ]);
  });
});
