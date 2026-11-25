import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { requestLogger } from '../../src/shared/middleware/request-logger.js';

function appWith(options: Parameters<typeof requestLogger>[0], trustProxy = 0) {
  const lines: Record<string, unknown>[] = [];
  let clock = 1000;
  const app = express();
  app.set('trust proxy', trustProxy);
  app.use(
    requestLogger({
      ...options,
      write: (l) => lines.push(JSON.parse(l)),
      now: () => (clock += 25),
    }),
  );
  app.get('/api/employees', (_req, res) => {
    res.status(200).json({ ok: true });
  });
  return { app, lines };
}

describe('requestLogger', () => {
  it('logs one JSON line per request without the query string', async () => {
    const { app, lines } = appWith({});

    await request(app).get('/api/employees?q=alice.smith').expect(200);

    expect(lines).toEqual([
      {
        time: expect.any(String),
        method: 'GET',
        path: '/api/employees',
        status: 200,
        ms: 25,
        ip: expect.any(String),
      },
    ]);
    expect(JSON.stringify(lines)).not.toContain('alice');
  });

  it('logs the client IP resolved through trusted proxies, and the raw chain only when asked', async () => {
    const { app, lines } = appWith({ includeForwardedFor: true }, 2);

    await request(app)
      .get('/api/employees')
      .set('X-Forwarded-For', '203.0.113.7, 198.51.100.2')
      .expect(200);

    expect(lines[0]).toMatchObject({
      ip: '203.0.113.7',
      forwardedFor: '203.0.113.7, 198.51.100.2',
    });
  });

  it('omits the forwarded chain by default', async () => {
    const { app, lines } = appWith({}, 2);

    await request(app)
      .get('/api/employees')
      .set('X-Forwarded-For', '203.0.113.7, 198.51.100.2')
      .expect(200);

    expect(lines[0]).not.toHaveProperty('forwardedFor');
  });
});
