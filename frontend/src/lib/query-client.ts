import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { sessionQueryKey } from '@/features/auth/session';
import { ApiError } from './api-client';

/**
 * Any 401 from the API means the session expired: clearing the cached session
 * makes <RequireAuth> send the user to /login (and back afterwards).
 */
export function createQueryClient(): QueryClient {
  const client: QueryClient = new QueryClient({
    queryCache: new QueryCache({ onError: (error) => handleUnauthorized(client, error) }),
    mutationCache: new MutationCache({ onError: (error) => handleUnauthorized(client, error) }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        // Retry only transient failures (network, 5xx), never client errors.
        retry: (failureCount, error) =>
          failureCount < 2 &&
          (!(error instanceof ApiError) || error.status === 0 || error.status >= 500),
      },
    },
  });
  return client;
}

function handleUnauthorized(client: QueryClient, error: unknown): void {
  if (error instanceof ApiError && error.isUnauthorized) {
    client.setQueryData(sessionQueryKey, null);
  }
}
