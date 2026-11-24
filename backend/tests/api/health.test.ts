import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';

function appWith(checkDatabase: () => Promise<void>) {
  return createApp({ checkDatabase, logger: { error: vi.fn() } });
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
  it('returns the standard 404 shape for unknown routes', async () => {
    const res = await request(healthyApp).get('/api/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: { code: 'NOT_FOUND', message: 'Route GET /api/does-not-exist not found' },
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
