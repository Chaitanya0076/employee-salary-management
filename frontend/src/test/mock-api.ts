import { vi } from 'vitest';

export interface MockResponse {
  status?: number;
  body?: unknown;
  /** Resolve the response only when this promise settles (to observe pending UI). */
  until?: Promise<unknown>;
}

export interface RecordedRequest {
  method: string;
  url: string;
  body: unknown;
}

type Handler = MockResponse | ((request: RecordedRequest) => MockResponse);

/**
 * Stubs global fetch with handlers keyed by "METHOD /path" (query ignored).
 * Unmatched requests fail the test loudly.
 */
export function mockApi(handlers: Record<string, Handler>) {
  const requests: RecordedRequest[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? 'GET').toUpperCase();
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
    const request = { method, url, body };
    requests.push(request);

    const key = `${method} ${url.split('?')[0]}`;
    const handler = handlers[key];
    if (!handler) throw new Error(`Unexpected request: ${key}`);
    const {
      status = 200,
      body: responseBody,
      until,
    } = typeof handler === 'function' ? handler(request) : handler;
    if (until) await until;
    return new Response(
      status === 204 || responseBody === undefined ? null : JSON.stringify(responseBody),
      { status, headers: { 'Content-Type': 'application/json' } },
    );
  });
  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, requests };
}

export const hrUser = {
  id: 1,
  email: 'hr.manager@acme.example',
  name: 'HR Manager',
  role: 'HR_MANAGER' as const,
};

export const unauthorized = {
  status: 401,
  body: { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
};
