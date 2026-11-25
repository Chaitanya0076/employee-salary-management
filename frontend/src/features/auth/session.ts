import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchSession, login, logout } from './api';
import type { User } from './types';

export const sessionQueryKey = ['session'] as const;

export function useSession() {
  return useQuery<User | null>({
    queryKey: sessionQueryKey,
    queryFn: fetchSession,
    staleTime: 5 * 60_000,
  });
}

export function useLogin() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: login,
    onSuccess: (user) => client.setQueryData(sessionQueryKey, user),
  });
}

export function useLogout() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: logout,
    // Drop all cached data (salaries!) even if the request failed.
    onSettled: () => {
      client.clear();
      client.setQueryData(sessionQueryKey, null);
    },
  });
}

/**
 * Where to go after login. Only same-app paths are accepted, so a crafted
 * `from` can't redirect the user to another site.
 */
export function safeRedirectPath(from: unknown): string {
  if (typeof from !== 'string' || !from.startsWith('/') || from.startsWith('//')) return '/';
  if (from === '/login' || from.startsWith('/login?')) return '/';
  return from;
}
