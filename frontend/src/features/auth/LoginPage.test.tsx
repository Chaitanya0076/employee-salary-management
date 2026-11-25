import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { hrUser, mockApi, unauthorized } from '@/test/mock-api';
import { renderApp } from '@/test/render-app';

afterEach(() => vi.unstubAllGlobals());

async function fillIn(email: string, password: string) {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText('Email'), email);
  await user.type(screen.getByLabelText('Password'), password);
  return user;
}

describe('LoginPage', () => {
  it('has labelled fields and keeps sign-in disabled until both are filled', async () => {
    mockApi({ 'GET /api/auth/me': unauthorized });
    renderApp('/login');

    expect(
      await screen.findByRole('heading', { name: 'ACME Salary Management' }),
    ).toBeInTheDocument();
    const submit = screen.getByRole('button', { name: 'Sign in' });
    expect(submit).toBeDisabled();

    await fillIn('hr.manager@acme.example', 'secret-password');
    expect(submit).toBeEnabled();
  });

  it('disables the form while signing in, then opens the dashboard', async () => {
    let respond!: () => void;
    const { requests } = mockApi({
      'GET /api/auth/me': unauthorized,
      'POST /api/auth/login': {
        body: { user: hrUser },
        until: new Promise<void>((r) => (respond = r)),
      },
    });
    const { router } = renderApp('/login');

    const user = await fillIn('  hr.manager@acme.example ', 'secret-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('button', { name: 'Signing in…' })).toBeDisabled();
    expect(screen.getByLabelText('Email')).toBeDisabled();
    expect(screen.getByLabelText('Password')).toBeDisabled();

    respond();

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
    expect(requests.find((r) => r.method === 'POST')?.body).toEqual({
      email: 'hr.manager@acme.example',
      password: 'secret-password',
    });
  });

  it('shows one generic message for wrong credentials and stays on the page', async () => {
    mockApi({
      'GET /api/auth/me': unauthorized,
      'POST /api/auth/login': {
        status: 401,
        body: { error: { code: 'UNAUTHORIZED', message: 'Invalid email or password' } },
      },
    });
    const { router } = renderApp('/login');

    const user = await fillIn('hr.manager@acme.example', 'wrong');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password.');
    expect(router.state.location.pathname).toBe('/login');
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
  });

  it("shows the server's message when rate-limited", async () => {
    mockApi({
      'GET /api/auth/me': unauthorized,
      'POST /api/auth/login': {
        status: 429,
        body: {
          error: {
            code: 'TOO_MANY_REQUESTS',
            message: 'Too many login attempts, please try again later',
          },
        },
      },
    });
    renderApp('/login');

    const user = await fillIn('hr.manager@acme.example', 'wrong');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Too many login attempts');
  });

  it('sends an already signed-in user straight to the app', async () => {
    mockApi({ 'GET /api/auth/me': { body: { user: hrUser } } });
    const { router } = renderApp('/login');

    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
  });
});
