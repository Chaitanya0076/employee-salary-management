import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api-client';
import { hrUser, mockApi, unauthorized } from '@/test/mock-api';
import { renderApp } from '@/test/render-app';

afterEach(() => vi.unstubAllGlobals());

describe('protected routes', () => {
  it('redirects to /login and back to the original page after signing in', async () => {
    let signedIn = false;
    mockApi({
      'GET /api/auth/me': () => (signedIn ? { body: { user: hrUser } } : unauthorized),
      'POST /api/auth/login': () => {
        signedIn = true;
        return { body: { user: hrUser } };
      },
    });
    const { router } = renderApp('/employees?country=GB');

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));

    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Email'), 'hr.manager@acme.example');
    await user.type(screen.getByLabelText('Password'), 'secret-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('heading', { name: 'Employees' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/employees');
    expect(router.state.location.search).toBe('?country=GB');
  });

  it('renders the app shell with navigation for a signed-in user', async () => {
    mockApi({ 'GET /api/auth/me': { body: { user: hrUser } } });
    renderApp('/insights');

    expect(await screen.findByRole('heading', { name: 'Insights' })).toBeInTheDocument();
    const nav = screen.getAllByRole('navigation', { name: 'Main' })[0]!;
    expect(nav).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Insights' })[0]).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute(
      'href',
      '#main',
    );
  });

  it('sends the user to /login when any request later returns 401 (expired session)', async () => {
    mockApi({ 'GET /api/auth/me': { body: { user: hrUser } } });
    const { router, client } = renderApp('/employees');
    expect(await screen.findByRole('heading', { name: 'Employees' })).toBeInTheDocument();

    // A data query failing with 401, as any page's request would after the cookie expires.
    await act(() =>
      client
        .fetchQuery({
          queryKey: ['employees'],
          queryFn: () =>
            Promise.reject(new ApiError(401, 'UNAUTHORIZED', 'Authentication required')),
        })
        .catch(() => {}),
    );

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(router.state.location.state).toEqual({ from: '/employees' });
  });

  it('shows a retry option when the session check fails for another reason', async () => {
    mockApi({
      'GET /api/auth/me': {
        status: 503,
        body: { error: { code: 'INTERNAL_ERROR', message: 'Service unavailable' } },
      },
    });
    renderApp('/');

    expect(
      await screen.findByRole('heading', { name: 'Something went wrong' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('signs out from the user menu and clears the session', async () => {
    let signedIn = true;
    mockApi({
      'GET /api/auth/me': () => (signedIn ? { body: { user: hrUser } } : unauthorized),
      'POST /api/auth/logout': () => {
        signedIn = false;
        return { status: 204 };
      },
    });
    const { router } = renderApp('/');

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Account menu for HR Manager' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Sign out' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });
});
