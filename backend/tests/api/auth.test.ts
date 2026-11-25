import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { INVALID_CREDENTIALS_MESSAGE } from '../../src/modules/auth/index.js';
import { TEST_PASSWORD, buildTestApp, hrUser, sessionCookieFrom } from '../helpers/auth.js';

const credentials = { email: hrUser.email, password: TEST_PASSWORD };

async function login(app = buildTestApp()) {
  const res = await request(app).post('/api/auth/login').send(credentials);
  return { app, res, cookie: sessionCookieFrom(res.headers['set-cookie']) };
}

describe('POST /api/auth/login', () => {
  it('returns the user and sets a hardened session cookie', async () => {
    const { res } = await login();

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      user: { id: 1, email: hrUser.email, name: 'HR Manager', role: 'HR_MANAGER' },
    });
    const setCookie = String(res.headers['set-cookie']);
    expect(setCookie).toMatch(/^session=[\w-]+\.[\w-]+\.[\w-]+;/);
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Lax');
    expect(setCookie).toContain('Path=/api');
    expect(setCookie).toContain('Expires=');
    expect(setCookie).not.toContain('Secure');
  });

  it('marks the cookie Secure when configured for production', async () => {
    const { res } = await login(buildTestApp({ cookie: { secure: true } }));

    expect(String(res.headers['set-cookie'])).toContain('Secure');
  });

  it('gives the same 401 for a wrong password and an unknown email', async () => {
    const app = buildTestApp();
    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ ...credentials, password: 'nope' });
    const unknownEmail = await request(app)
      .post('/api/auth/login')
      .send({ ...credentials, email: 'someone@acme.example' });

    for (const res of [wrongPassword, unknownEmail]) {
      expect(res.status).toBe(401);
      expect(res.body).toEqual({
        error: { code: 'UNAUTHORIZED', message: INVALID_CREDENTIALS_MESSAGE },
      });
      expect(res.headers['set-cookie']).toBeUndefined();
    }
  });

  it('validates the request body', async () => {
    const res = await request(buildTestApp())
      .post('/api/auth/login')
      .send({ email: 'not-an-email', password: '' });

    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d: { path: string }) => d.path)).toEqual([
      'body.email',
      'body.password',
    ]);
  });

  it('rate-limits repeated failed attempts but not successful logins', async () => {
    const app = buildTestApp({ loginRateLimit: { limit: 3, windowMs: 60_000 } });
    const fail = () =>
      request(app)
        .post('/api/auth/login')
        .send({ ...credentials, password: 'nope' });

    // Successful logins do not use up the allowance.
    await request(app).post('/api/auth/login').send(credentials).expect(200);
    await request(app).post('/api/auth/login').send(credentials).expect(200);

    for (let i = 0; i < 3; i++) await fail().expect(401);
    const blocked = await fail();

    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('TOO_MANY_REQUESTS');
    // Once blocked, even correct credentials must wait for the window to pass.
    await request(app).post('/api/auth/login').send(credentials).expect(429);
  });
});

describe('login rate limit behind proxies', () => {
  it('counts attempts per real client IP when TRUST_PROXY matches the proxy chain', async () => {
    // Production path: browser -> Vercel rewrite -> Render router -> app (TRUST_PROXY=2).
    const app = buildTestApp({ trustProxy: 2, loginRateLimit: { limit: 2, windowMs: 60_000 } });
    const failFrom = (clientIp: string) =>
      request(app)
        .post('/api/auth/login')
        .set('X-Forwarded-For', `${clientIp}, 198.51.100.2`)
        .send({ ...credentials, password: 'nope' });

    await failFrom('203.0.113.1').expect(401);
    await failFrom('203.0.113.1').expect(401);
    await failFrom('203.0.113.1').expect(429);

    // A different client behind the same proxies has its own allowance.
    await failFrom('203.0.113.99').expect(401);
  });
});

describe('GET /api/auth/me', () => {
  it('returns the current user with a valid session', async () => {
    const { app, cookie } = await login();

    const res = await request(app).get('/api/auth/me').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ id: 1, email: hrUser.email });
  });

  it('responds 401 without a session cookie', async () => {
    const res = await request(buildTestApp()).get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('responds 401 for a forged session cookie', async () => {
    const res = await request(buildTestApp())
      .get('/api/auth/me')
      .set('Cookie', 'session=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.forged');

    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('clears the session cookie', async () => {
    const { app, cookie } = await login();

    const res = await request(app).post('/api/auth/logout').set('Cookie', cookie);

    expect(res.status).toBe(204);
    const cleared = String(res.headers['set-cookie']);
    expect(cleared).toMatch(/^session=;/);
    expect(cleared).toContain('Expires=Thu, 01 Jan 1970');
    expect(cleared).toContain('Path=/api');
  });

  it('succeeds without a session, so an expired session can still log out', async () => {
    await request(buildTestApp()).post('/api/auth/logout').expect(204);
  });
});

describe('protected by default', () => {
  it('requires a session for any /api route other than health and login/logout', async () => {
    const res = await request(buildTestApp()).get('/api/employees');

    expect(res.status).toBe(401);
  });

  it('returns 404 for unknown routes once authenticated', async () => {
    const { app, cookie } = await login();

    const res = await request(app).get('/api/does-not-exist').set('Cookie', cookie);

    expect(res.status).toBe(404);
  });
});
