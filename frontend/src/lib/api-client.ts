/**
 * Thin fetch wrapper for the backend API. Every failure becomes an ApiError
 * mirroring the server's `{ error: { code, message, details } }` shape, so
 * callers handle one error type.
 */
export interface ApiErrorDetail {
  /** Server path such as "body.email" or "query.country". */
  path: string;
  message: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: ApiErrorDetail[];

  constructor(status: number, code: string, message: string, details: ApiErrorDetail[] = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  /** Field-level messages keyed by field name ("body.email" -> "email"), for forms. */
  fieldErrors(): Record<string, string> {
    const fields: Record<string, string> = {};
    for (const { path, message } of this.details) {
      const field = path.replace(/^(body|query|params)\.?/, '') || '_';
      fields[field] ??= message;
    }
    return fields;
  }
}

export const NETWORK_ERROR = 'NETWORK_ERROR';

export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? '/api';

export type QueryValue = string | number | boolean | null | undefined;

export interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  /** Serialised as JSON. */
  body?: unknown;
  /** Undefined, null and empty-string values are omitted. */
  query?: Record<string, QueryValue>;
}

export function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  const search = params.toString();
  return `${API_BASE_URL}${path}${search ? `?${search}` : ''}`;
}

interface ErrorBody {
  error?: { code?: string; message?: string; details?: ApiErrorDetail[] };
}

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export async function apiFetch<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { body, query, headers, ...init } = options;
  let res: Response;
  try {
    res = await fetch(buildUrl(path, query), {
      ...init,
      // The session is an httpOnly cookie on the same origin.
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(
      0,
      NETWORK_ERROR,
      'Cannot reach the server. Check your connection and try again.',
    );
  }

  if (res.status === 204) return undefined as T;
  const payload = await readJson(res);

  if (!res.ok) {
    const error = (payload as ErrorBody | undefined)?.error;
    throw new ApiError(
      res.status,
      error?.code ?? 'HTTP_ERROR',
      error?.message ?? `Request failed (${res.status})`,
      error?.details ?? [],
    );
  }
  return payload as T;
}
