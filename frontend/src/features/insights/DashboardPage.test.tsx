import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { analyticsHandlers } from '@/test/fixtures/analytics';
import { referenceHandlers } from '@/test/fixtures/employees';
import { hrUser, mockApi } from '@/test/mock-api';
import { renderApp } from '@/test/render-app';

afterEach(() => vi.unstubAllGlobals());

function setup(overrides = {}) {
  mockApi({
    'GET /api/auth/me': { body: { user: hrUser } },
    ...referenceHandlers,
    ...analyticsHandlers,
    ...overrides,
  });
  return renderApp('/');
}

describe('DashboardPage', () => {
  it('shows the headline figures from the summary', async () => {
    setup();

    const kpis = await screen.findByRole('region', { name: 'Key figures' });
    expect(await within(kpis).findByText('9,601')).toBeInTheDocument();
    expect(within(kpis).getByText('$819.1M')).toBeInTheDocument();
    expect(within(kpis).getByText('$819,144,586.80 · USD equivalent')).toBeInTheDocument();
    expect(within(kpis).getByText('$85.3K')).toBeInTheDocument();
    expect(within(kpis).getByText('$75.7K')).toBeInTheDocument();
  });

  it('links the headcount tile to the active employees list', async () => {
    setup();

    const tile = await screen.findByRole('link', { name: /Active employees/ });
    expect(tile).toHaveAttribute('href', '/employees?status=ACTIVE');
  });

  it('offers every chart as a table, with local and USD amounts and links to filtered views', async () => {
    setup();

    const countryChart = (
      await screen.findByRole('heading', { name: 'Total pay by country' })
    ).closest('[data-slot="card"]')!;
    const india = await within(countryChart as HTMLElement).findByRole('link', { name: 'India' });
    expect(india).toHaveAttribute('href', '/employees?country=IN&status=ACTIVE');
    const row = india.closest('tr')!;
    expect(within(row).getByText('₹3,570,991,850.00')).toBeInTheDocument();
    expect(within(row).getByText('$42,851,902.20')).toBeInTheDocument();

    expect(await screen.findByRole('link', { name: 'Engineering' })).toHaveAttribute(
      'href',
      '/employees?department=1&status=ACTIVE',
    );
    expect(screen.getAllByText('View as table')).toHaveLength(3);
  });

  it('shows an error state with retry when a chart fails', async () => {
    setup({
      'GET /api/analytics/by-department': {
        status: 500,
        body: { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      },
    });

    const card = (await screen.findByRole('heading', { name: 'Total pay by department' })).closest(
      '[data-slot="card"]',
    ) as HTMLElement;
    expect(await within(card).findByRole('alert')).toHaveTextContent("Couldn't load this chart");
    expect(within(card).getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
