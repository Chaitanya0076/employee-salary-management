import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { hrUser, mockApi, type MockResponse } from '@/test/mock-api';
import { renderApp } from '@/test/render-app';

afterEach(() => vi.unstubAllGlobals());

const rates = [
  { currency: 'GBP', rateToUsd: '1.27000000', updatedAt: '2026-11-01T10:00:00.000Z' },
  { currency: 'USD', rateToUsd: '1.00000000', updatedAt: '2026-11-01T10:00:00.000Z' },
];

function setup(
  putResponse: MockResponse = {
    body: { currency: 'GBP', rateToUsd: '1.30000000', updatedAt: '2026-11-25T09:00:00.000Z' },
  },
) {
  const api = mockApi({
    'GET /api/auth/me': { body: { user: hrUser } },
    'GET /api/fx-rates': { body: { data: rates } },
    'PUT /api/fx-rates/GBP': putResponse,
  });
  renderApp('/settings/fx-rates');
  return { ...api, user: userEvent.setup() };
}

const rowFor = async (currency: string) =>
  (await screen.findByRole('cell', { name: new RegExp(`^${currency}`) })).closest(
    'tr',
  ) as HTMLElement;

describe('FxRatesPage', () => {
  it('lists rates with their inverse and locks the reporting currency', async () => {
    setup();

    const gbp = await rowFor('GBP');
    expect(within(gbp).getByText('1.27')).toBeInTheDocument();
    expect(within(gbp).getByText('0.7874 GBP')).toBeInTheDocument();
    const usd = await rowFor('USD');
    expect(within(usd).getByText('Reporting currency')).toBeInTheDocument();
    expect(within(usd).queryByRole('button', { name: /Edit/ })).not.toBeInTheDocument();
  });

  it('edits a rate inline and saves it', async () => {
    const { user, requests } = setup();
    const gbp = await rowFor('GBP');

    await user.click(within(gbp).getByRole('button', { name: 'Edit GBP rate' }));
    const input = within(gbp).getByLabelText('Rate to USD for GBP');
    expect(input).toHaveValue('1.27');
    await user.clear(input);
    await user.type(input, '1.3{Enter}');

    expect(await screen.findByText('GBP rate updated')).toBeInTheDocument();
    expect(requests.find((r) => r.method === 'PUT')?.body).toEqual({ rateToUsd: '1.3' });
    await waitFor(() => expect(within(gbp).getByText('1.3')).toBeInTheDocument());
    expect(within(gbp).queryByLabelText('Rate to USD for GBP')).not.toBeInTheDocument();
  });

  it.each([
    ['', 'Enter a rate'],
    ['0', 'Must be greater than 0'],
    ['1.123456789', 'Use a number with up to 8 decimal places'],
    ['abc', 'Use a number with up to 8 decimal places'],
  ])('rejects %j before sending', async (value, message) => {
    const { user, requests } = setup();
    const gbp = await rowFor('GBP');
    await user.click(within(gbp).getByRole('button', { name: 'Edit GBP rate' }));
    const input = within(gbp).getByLabelText('Rate to USD for GBP');

    await user.clear(input);
    if (value) await user.type(input, value);
    await user.click(within(gbp).getByRole('button', { name: 'Save' }));

    expect(within(gbp).getByText(message)).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(requests.some((r) => r.method === 'PUT')).toBe(false);
  });

  it('shows a server validation message and cancels with Escape', async () => {
    const { user } = setup({
      status: 400,
      body: {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: [{ path: 'body.rateToUsd', message: 'Must be greater than 0' }],
        },
      },
    });
    const gbp = await rowFor('GBP');
    await user.click(within(gbp).getByRole('button', { name: 'Edit GBP rate' }));
    const input = within(gbp).getByLabelText('Rate to USD for GBP');
    await user.clear(input);
    await user.type(input, '2{Enter}');

    expect(await within(gbp).findByText('Must be greater than 0')).toBeInTheDocument();

    await user.type(input, '{Escape}');
    expect(within(gbp).queryByLabelText('Rate to USD for GBP')).not.toBeInTheDocument();
    expect(within(gbp).getByText('1.27')).toBeInTheDocument();
  });
});
