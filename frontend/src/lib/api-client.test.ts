import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockApi } from '@/test/mock-api';
import { ApiError, NETWORK_ERROR, apiFetch, buildUrl } from './api-client';

afterEach(() => vi.unstubAllGlobals());

describe('buildUrl', () => {
  it('prefixes /api and skips empty query values', () => {
    expect(
      buildUrl('/employees', { q: 'smith', page: 2, country: undefined, level: '', status: null }),
    ).toBe('/api/employees?q=smith&page=2');
    expect(buildUrl('/employees')).toBe('/api/employees');
  });
});

describe('apiFetch', () => {
  it('returns parsed JSON and sends JSON bodies with the session cookie', async () => {
    const { fetchMock } = mockApi({ 'POST /api/things': { status: 201, body: { id: 7 } } });

    await expect(apiFetch('/things', { method: 'POST', body: { name: 'x' } })).resolves.toEqual({
      id: 7,
    });

    const [, init] = fetchMock.mock.calls[0]!;
    expect(init).toMatchObject({
      method: 'POST',
      credentials: 'same-origin',
      body: '{"name":"x"}',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    });
  });

  it('returns undefined for 204 No Content', async () => {
    mockApi({ 'POST /api/auth/logout': { status: 204 } });

    await expect(apiFetch('/auth/logout', { method: 'POST' })).resolves.toBeUndefined();
  });

  it('maps the API error shape to an ApiError with field errors', async () => {
    mockApi({
      'POST /api/employees': {
        status: 400,
        body: {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            details: [
              { path: 'body.email', message: 'Enter a valid email address' },
              { path: 'body.compensation.components.0.amount', message: 'Must be greater than 0' },
            ],
          },
        },
      },
    });

    const error = await apiFetch('/employees', { method: 'POST', body: {} }).catch(
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
    });
    expect((error as ApiError).fieldErrors()).toEqual({
      email: 'Enter a valid email address',
      'compensation.components.0.amount': 'Must be greater than 0',
    });
  });

  it('flags 401 responses as unauthorized', async () => {
    mockApi({
      'GET /api/auth/me': {
        status: 401,
        body: { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      },
    });

    const error = (await apiFetch('/auth/me').catch((e: unknown) => e)) as ApiError;

    expect(error.isUnauthorized).toBe(true);
  });

  it('handles error responses without a JSON body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('<html>Bad gateway</html>', { status: 502 })),
    );

    await expect(apiFetch('/employees')).rejects.toMatchObject({
      status: 502,
      code: 'HTTP_ERROR',
      message: 'Request failed (502)',
    });
  });

  it('turns network failures into a NETWORK_ERROR with status 0', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );

    await expect(apiFetch('/employees')).rejects.toMatchObject({ status: 0, code: NETWORK_ERROR });
  });
});
