import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildTestApp } from '../helpers/auth.js';

function appWith(checkDatabase: () => Promise<void>) {
  return buildTestApp({ checkDatabase });
}

const healthyApp = appWith(async () => {});

describe('GET /api/health', () => {
  it('returns 200 ok when the database is reachable', async () => {
    const res = await request(healthyApp).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      status: 'ok',
      uptimeSeconds: expect.any(Number),
      timestamp: expect.any(String),
      checks: { database: 'up' },
    });
    expect(Number.isNaN(Date.parse(res.body.timestamp))).toBe(false);
  });

  it('returns 503 degraded when the database check fails', async () => {
    const app = appWith(() => Promise.reject(new Error('ECONNREFUSED')));

    const res = await request(app).get('/api/health');

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ status: 'degraded', checks: { database: 'down' } });
    expect(JSON.stringify(res.body)).not.toContain('ECONNREFUSED');
  });

  it('sends security headers', async () => {
    const res = await request(healthyApp).get('/api/health');

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

describe('API error responses', () => {
  it('returns 401 (not 404) for unknown routes without a session, so routes are not revealed', async () => {
    const res = await request(healthyApp).get('/api/does-not-exist');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
    });
  });

  it('returns 400 for malformed JSON bodies', async () => {
    const res = await request(healthyApp)
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send('{"broken":');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });
});
