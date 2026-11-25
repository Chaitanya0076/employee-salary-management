import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { AppProviders } from '@/app-providers';
import { createQueryClient } from '@/lib/query-client';
import { routes } from '@/routes';

/** Renders the real app (routes, guards, providers) at a URL, with a fresh cache. */
export function renderApp(initialPath = '/') {
  const router = createMemoryRouter(routes, { initialEntries: [initialPath] });
  const client = createQueryClient();
  // No retries in tests: failures should surface immediately.
  client.setDefaultOptions({ queries: { ...client.getDefaultOptions().queries, retry: false } });
  const result = render(
    <AppProviders client={client}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { ...result, router, client };
}
