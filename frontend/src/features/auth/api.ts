import { ApiError, apiFetch } from '@/lib/api-client';
import type { User } from './types';

/** The current user, or null when there is no valid session. */
export async function fetchSession(): Promise<User | null> {
  try {
    const { user } = await apiFetch<{ user: User }>('/auth/me');
    return user;
  } catch (error) {
    if (error instanceof ApiError && error.isUnauthorized) return null;
    throw error;
  }
}

export async function login(credentials: { email: string; password: string }): Promise<User> {
  const { user } = await apiFetch<{ user: User }>('/auth/login', {
    method: 'POST',
    body: credentials,
  });
  return user;
}

export function logout(): Promise<void> {
  return apiFetch<void>('/auth/logout', { method: 'POST' });
}
