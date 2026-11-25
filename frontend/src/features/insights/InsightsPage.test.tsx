import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { analyticsHandlers, byLevelInr, byLevelUsd } from '@/test/fixtures/analytics';
import { referenceHandlers } from '@/test/fixtures/employees';
import { hrUser, mockApi, type RecordedRequest } from '@/test/mock-api';
import { renderApp } from '@/test/render-app';

afterEach(() => vi.unstubAllGlobals());

function setup(path = '/insights') {
  const api = mockApi({
    'GET /api/auth/me': { body: { user: hrUser } },
    ...referenceHandlers,
    ...analyticsHandlers,
    // Local currency when one country is selected, USD otherwise (as the API does).
    'GET /api/analytics/by-level': (req: RecordedRequest) => ({
      body:
        new URL(req.url, 'http://x').searchParams.get('country') === 'IN' ? byLevelInr : byLevelUsd,
    }),
  });
  const app = renderApp(path);
  const lastQuery = (name: string) => {
    const req = api.requests.filter((r) => r.url.startsWith(`/api/analytics/${name}`)).at(-1);
    return req ? Object.fromEntries(new URL(req.url, 'http://x').searchParams) : undefined;
  };
  return { ...api, ...app, lastQuery, user: userEvent.setup() };
}

describe('InsightsPage', () => {
  it('puts the country filter in the URL and applies it to every insight', async () => {
    const { router, lastQuery, user } = setup();
    await waitFor(() => expect(screen.getByRole('option', { name: 'India' })).toBeInTheDocument());

    await user.selectOptions(screen.getByLabelText('Country'), 'IN');

    await waitFor(() => expect(router.state.location.search).toBe('?country=IN'));
    await waitFor(() => expect(lastQuery('summary')).toEqual({ country: 'IN' }));
    expect(lastQuery('by-level')).toEqual({ country: 'IN' });
    expect(lastQuery('by-department')).toEqual({ country: 'IN' });
    expect(lastQuery('headcount-trend')).toEqual({ country: 'IN' });
    expect(lastQuery('distribution')).toEqual({ country: 'IN', buckets: '10' });
    // The by-country breakdown can't filter by country server-side; it's narrowed in the page.
    expect(lastQuery('by-country')).toEqual({});
  });

  it('restores filters from the URL', async () => {
    const { lastQuery } = setup('/insights?country=IN&department=1&buckets=20');

    await waitFor(() =>
      expect(lastQuery('distribution')).toEqual({ country: 'IN', department: '1', buckets: '20' }),
    );
    await waitFor(() => expect(screen.getByLabelText('Country')).toHaveValue('IN'));
    expect(screen.getByLabelText('Department')).toHaveValue('1');
    expect(screen.getByLabelText('Ranges')).toHaveValue('20');
  });

  it('shows level stats in USD across countries and in local currency for one country', async () => {
    setup();
    const usdCard = (
      await screen.findByRole('heading', { name: 'Base pay by level (USD)' })
    ).closest('[data-slot="card"]') as HTMLElement;
    expect(await within(usdCard).findByText('$48,895.00')).toBeInTheDocument();
    expect(within(usdCard).getByText(/as USD equivalents/)).toBeInTheDocument();
  });

  it('switches level stats to the local currency when a country is selected', async () => {
    setup('/insights?country=IN');

    const inrCard = (
      await screen.findByRole('heading', { name: 'Base pay by level (INR)' })
    ).closest('[data-slot="card"]') as HTMLElement;
    expect(await within(inrCard).findByText('₹744,800.00')).toBeInTheDocument();
    expect(within(inrCard).getByText(/in India's currency \(INR\)/)).toBeInTheDocument();
  });

  it('narrows the country table to the selected country', async () => {
    setup('/insights?country=IN');

    const card = (await screen.findByRole('heading', { name: 'Pay by country' })).closest(
      '[data-slot="card"]',
    ) as HTMLElement;
    expect(await within(card).findByRole('link', { name: 'India' })).toBeInTheDocument();
    expect(within(card).queryByRole('link', { name: 'United States' })).not.toBeInTheDocument();
  });

  it('changes the number of distribution ranges', async () => {
    const { router, lastQuery, user } = setup();
    await screen.findByLabelText('Ranges');

    await user.selectOptions(screen.getByLabelText('Ranges'), '5');

    await waitFor(() => expect(router.state.location.search).toBe('?buckets=5'));
    await waitFor(() => expect(lastQuery('distribution')).toEqual({ buckets: '5' }));
  });
});
