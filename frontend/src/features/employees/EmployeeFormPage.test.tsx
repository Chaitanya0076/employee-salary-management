import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { bobDetail, bobHistory, referenceHandlers } from '@/test/fixtures/employees';
import { hrUser, mockApi, type MockResponse } from '@/test/mock-api';
import { renderApp } from '@/test/render-app';

afterEach(() => vi.unstubAllGlobals());

function setupCreate(
  createResponse: MockResponse = {
    status: 201,
    body: { ...bobDetail, id: 6, employeeCode: 'EMP-00006' },
  },
) {
  const api = mockApi({
    'GET /api/auth/me': { body: { user: hrUser } },
    ...referenceHandlers,
    'POST /api/employees': createResponse,
    'GET /api/employees/6': { body: { ...bobDetail, id: 6, employeeCode: 'EMP-00006' } },
    'GET /api/employees/6/compensation': { body: { ...bobHistory, employeeId: 6 } },
  });
  return { ...api, ...renderApp('/employees/new'), user: userEvent.setup() };
}

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText('First name'), 'Farah');
  await user.type(screen.getByLabelText('Last name'), 'Khan');
  await user.type(screen.getByLabelText('Email'), 'farah.khan@acme.example');
  await user.type(screen.getByLabelText('Job title'), 'Software Engineer');
  await waitFor(() =>
    expect(screen.getByRole('option', { name: 'Engineering' })).toBeInTheDocument(),
  );
  await user.selectOptions(screen.getByLabelText('Department'), 'Engineering');
  await user.selectOptions(screen.getByLabelText('Level'), 'L2');
  await user.selectOptions(screen.getByLabelText('Country'), 'IN');
  await user.clear(screen.getByLabelText('Hire date'));
  await user.type(screen.getByLabelText('Hire date'), '2026-05-01');
  await user.type(screen.getByLabelText('Base salary'), ' 1200000.50 ');
}

describe('New employee form', () => {
  it('validates required fields on the client and sends nothing', async () => {
    const { user, requests } = setupCreate();

    await user.click(await screen.findByRole('button', { name: 'Create employee' }));

    expect(await screen.findByText('First name is required')).toBeInTheDocument();
    // The placeholder option has the same text, so match the error paragraph.
    expect(screen.getByText('Select a department', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByText('Select a country', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByText('Enter an amount')).toBeInTheDocument();
    expect(screen.getByLabelText('First name')).toHaveAttribute('aria-invalid', 'true');
    expect(requests.some((r) => r.method === 'POST')).toBe(false);
  });

  it('rejects a future hire date and a malformed amount', async () => {
    const { user } = setupCreate();
    await fillValidForm(user);
    await user.clear(screen.getByLabelText('Hire date'));
    await user.type(screen.getByLabelText('Hire date'), '2999-01-01');
    await user.clear(screen.getByLabelText('Base salary'));
    await user.type(screen.getByLabelText('Base salary'), '12.345');

    await user.click(screen.getByRole('button', { name: 'Create employee' }));

    expect(await screen.findByText('Hire date cannot be in the future')).toBeInTheDocument();
    expect(screen.getByText('Use a number with up to 2 decimal places')).toBeInTheDocument();
  });

  it('shows the currency for the chosen country and adds optional components', async () => {
    const { user } = setupCreate();
    await fillValidForm(user);

    expect(screen.getByText('Annual pay (INR)')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add bonus' }));
    expect(screen.getByLabelText('Bonus')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add bonus' })).not.toBeInTheDocument();
  });

  it('creates the employee and opens their page', async () => {
    const { user, requests, router } = setupCreate();
    await fillValidForm(user);

    await user.click(screen.getByRole('button', { name: 'Create employee' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/employees/6'));
    expect(requests.find((r) => r.method === 'POST')?.body).toEqual({
      firstName: 'Farah',
      lastName: 'Khan',
      email: 'farah.khan@acme.example',
      jobTitle: 'Software Engineer',
      level: 'L2',
      departmentId: 1,
      hireDate: '2026-05-01',
      countryCode: 'IN',
      compensation: { components: [{ type: 'BASE', amount: '1200000.50' }] },
    });
    expect(await screen.findByText('Bob Jones added')).toBeInTheDocument();
  });

  it('puts a duplicate-email conflict on the email field', async () => {
    const { user } = setupCreate({
      status: 409,
      body: {
        error: {
          code: 'CONFLICT',
          message: 'An employee with this email already exists',
          details: [{ path: 'body.email', message: 'farah.khan@acme.example is already in use' }],
        },
      },
    });
    await fillValidForm(user);

    await user.click(screen.getByRole('button', { name: 'Create employee' }));

    expect(
      await screen.findByText('farah.khan@acme.example is already in use'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
  });

  it('maps server validation details onto fields and shows the rest in an alert', async () => {
    const { user } = setupCreate({
      status: 400,
      body: {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: [
            { path: 'body.hireDate', message: 'Hire date cannot be in the future' },
            { path: 'body.compensation.components.0.amount', message: 'Must be greater than 0' },
            { path: 'body.departmentId', message: 'Unknown department 1' },
            { path: 'body', message: 'Something else' },
          ],
        },
      },
    });
    await fillValidForm(user);

    await user.click(screen.getByRole('button', { name: 'Create employee' }));

    expect(await screen.findByText('Must be greater than 0')).toBeInTheDocument();
    expect(screen.getByText('Unknown department 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Base salary')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Something else');
  });
});

describe('Edit employee form', () => {
  it('locks the country and sends only the changed fields', async () => {
    const api = mockApi({
      'GET /api/auth/me': { body: { user: hrUser } },
      ...referenceHandlers,
      'GET /api/employees/2': { body: bobDetail },
      'GET /api/employees/2/compensation': { body: bobHistory },
      'PATCH /api/employees/2': { body: { ...bobDetail, jobTitle: 'Senior Account Executive' } },
    });
    const { router } = renderApp('/employees/2/edit');
    const user = userEvent.setup();

    expect(await screen.findByLabelText('Country')).toBeDisabled();
    expect(screen.getByLabelText('Country')).toHaveValue('United Kingdom (GBP)');

    await user.clear(screen.getByLabelText('Job title'));
    await user.type(screen.getByLabelText('Job title'), 'Senior Account Executive');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/employees/2'));
    expect(api.requests.find((r) => r.method === 'PATCH')?.body).toEqual({
      jobTitle: 'Senior Account Executive',
    });
  });
});
