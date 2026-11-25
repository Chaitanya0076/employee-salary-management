import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { bobDetail, bobHistory, referenceHandlers } from '@/test/fixtures/employees';
import { hrUser, mockApi, type MockResponse } from '@/test/mock-api';
import { renderApp } from '@/test/render-app';

afterEach(() => vi.unstubAllGlobals());

const changeResult = {
  compensation: {
    ...bobHistory.current,
    id: 3,
    effectiveFrom: '2026-04-01',
    base: '55000.00',
    total: '57000.00',
  },
  previous: { ...bobHistory.current, effectiveTo: '2026-04-01' },
  change: {
    base: { amount: '5000.00', percent: '10.00' },
    total: { amount: '5000.00', percent: '9.62' },
  },
};

function setup(
  changeResponse: MockResponse = { status: 201, body: changeResult },
  detail = bobDetail,
) {
  const api = mockApi({
    'GET /api/auth/me': { body: { user: hrUser } },
    ...referenceHandlers,
    'GET /api/employees/2': { body: detail },
    'GET /api/employees/2/compensation': { body: bobHistory },
    'POST /api/employees/2/compensation': changeResponse,
  });
  renderApp('/employees/2');
  return { ...api, user: userEvent.setup() };
}

async function openDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Record pay change' }));
  return screen.findByRole('dialog', { name: 'Record pay change' });
}

async function setEffectiveDate(
  user: ReturnType<typeof userEvent.setup>,
  dialog: HTMLElement,
  date: string,
) {
  const input = within(dialog).getByLabelText('Effective from');
  await user.clear(input);
  await user.type(input, date);
}

describe('Record pay change', () => {
  it('starts from current pay, previews the change, and records it', async () => {
    const { user, requests } = setup();
    const dialog = await openDialog(user);

    expect(within(dialog).getByLabelText('Base salary')).toHaveValue('50000.00');
    expect(within(dialog).getByLabelText('Allowance')).toHaveValue('2000.00');

    await setEffectiveDate(user, dialog, '2026-04-01');
    await user.clear(within(dialog).getByLabelText('Base salary'));
    await user.type(within(dialog).getByLabelText('Base salary'), '55000');
    await user.type(within(dialog).getByLabelText('Reason (optional)'), 'Annual review');

    const preview = within(dialog).getByRole('region', { name: 'Change from current pay' });
    expect(preview).toHaveTextContent('£50,000.00 → £55,000.00 (+£5,000.00, +10.00%)');
    expect(preview).toHaveTextContent('£52,000.00 → £57,000.00 (+£5,000.00, +9.62%)');

    const detailFetchesBefore = requests.filter((r) => r.url === '/api/employees/2').length;
    await user.click(within(dialog).getByRole('button', { name: 'Record change' }));

    expect(await screen.findByText('Pay change recorded')).toBeInTheDocument();
    expect(screen.getByText('Bob Jones: total pay +£5,000.00 (+9.62%)')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(requests.find((r) => r.method === 'POST')?.body).toEqual({
      effectiveFrom: '2026-04-01',
      components: [
        { type: 'BASE', amount: '55000' },
        { type: 'ALLOWANCE', amount: '2000.00' },
      ],
      reason: 'Annual review',
    });
    // Detail and history are refreshed after the change.
    await waitFor(() =>
      expect(requests.filter((r) => r.url === '/api/employees/2').length).toBeGreaterThan(
        detailFetchesBefore,
      ),
    );
  });

  it('validates the date against the current pay before sending', async () => {
    const { user, requests } = setup();
    const dialog = await openDialog(user);

    await setEffectiveDate(user, dialog, '2021-03-01');
    await user.click(within(dialog).getByRole('button', { name: 'Record change' }));

    expect(
      await within(dialog).findByText("Must be after the current pay's start date (2021-03-01)"),
    ).toBeInTheDocument();
    expect(requests.some((r) => r.method === 'POST')).toBe(false);
  });

  it('keeps base salary mandatory but lets bonus and allowance be removed', async () => {
    const { user } = setup();
    const dialog = await openDialog(user);

    expect(
      within(dialog).queryByRole('button', { name: 'Remove base salary' }),
    ).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Remove allowance' }));
    expect(within(dialog).queryByLabelText('Allowance')).not.toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Add allowance' })).toBeInTheDocument();
  });

  it('shows a conflict (409) as an alert and keeps the dialog open', async () => {
    const { user } = setup({
      status: 409,
      body: {
        error: {
          code: 'CONFLICT',
          message: 'Pay was changed by another request; reload and try again',
        },
      },
    });
    const dialog = await openDialog(user);
    await setEffectiveDate(user, dialog, '2026-04-01');
    await user.clear(within(dialog).getByLabelText('Base salary'));
    await user.type(within(dialog).getByLabelText('Base salary'), '55000');

    await user.click(within(dialog).getByRole('button', { name: 'Record change' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Pay was changed by another request',
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('maps server validation errors (400) onto the fields', async () => {
    const { user } = setup({
      status: 400,
      body: {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: [
            { path: 'body.components', message: 'New pay is identical to the current pay' },
          ],
        },
      },
    });
    const dialog = await openDialog(user);
    await setEffectiveDate(user, dialog, '2026-04-01');

    await user.click(within(dialog).getByRole('button', { name: 'Record change' }));

    expect(
      await within(dialog).findByText('New pay is identical to the current pay'),
    ).toBeInTheDocument();
  });

  it('is unavailable for an inactive employee', async () => {
    setup(undefined, { ...bobDetail, status: 'INACTIVE' });

    expect(await screen.findByRole('button', { name: 'Record pay change' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Reactivate' })).toBeInTheDocument();
  });
});
