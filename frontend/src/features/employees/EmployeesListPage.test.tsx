import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { alice, bob, page, referenceHandlers } from '@/test/fixtures/employees';
import { hrUser, mockApi, type RecordedRequest } from '@/test/mock-api';
import { renderApp } from '@/test/render-app';

afterEach(() => vi.unstubAllGlobals());

function setup(
  path: string,
  listResponse: { status?: number; body?: unknown } = { body: page([bob, alice]) },
) {
  const api = mockApi({
    'GET /api/auth/me': { body: { user: hrUser } },
    ...referenceHandlers,
    'GET /api/employees': listResponse,
  });
  const app = renderApp(path);
  const listRequests = () =>
    api.requests
      .filter((r: RecordedRequest) => r.url.startsWith('/api/employees?'))
      .map((r) => new URL(r.url, 'http://x').searchParams);
  return { ...api, ...app, listRequests, user: userEvent.setup() };
}

describe('EmployeesListPage', () => {
  it('shows employees with current pay in local currency and USD', async () => {
    const { listRequests } = setup('/employees');

    const row = (await screen.findByRole('link', { name: 'Bob Jones' })).closest('tr')!;
    expect(within(row).getByText('EMP-00002 · Account Executive')).toBeInTheDocument();
    expect(within(row).getByText('£50,000.00')).toBeInTheDocument();
    expect(within(row).getByText('$66,040.00')).toBeInTheDocument();
    expect(screen.getByText('Showing 1–2 of 2')).toBeInTheDocument();
    expect(Object.fromEntries(listRequests()[0]!)).toEqual({
      sort: 'name:asc',
      page: '1',
      pageSize: '25',
    });
  });

  it('restores filters, sort and page from the URL and sends them to the API', async () => {
    const { listRequests } = setup('/employees?country=GB&sort=totalUsd:desc&page=2', {
      body: page([bob], { page: 2, total: 30, totalPages: 2 }),
    });

    expect(await screen.findByRole('link', { name: 'Bob Jones' })).toBeInTheDocument();
    expect(Object.fromEntries(listRequests()[0]!)).toEqual({
      country: 'GB',
      sort: 'totalUsd:desc',
      page: '2',
      pageSize: '25',
    });
    await waitFor(() => expect(screen.getByLabelText('Country')).toHaveValue('GB'));
    expect(screen.getByRole('columnheader', { name: /Total \(USD\)/ })).toHaveAttribute(
      'aria-sort',
      'descending',
    );
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
  });

  it('updates the URL and resets to page 1 when a filter changes', async () => {
    const { router, listRequests, user } = setup('/employees?page=3');
    await screen.findByRole('link', { name: 'Bob Jones' });
    await waitFor(() =>
      expect(within(screen.getByLabelText('Country')).getAllByRole('option')).toHaveLength(4),
    );

    await user.selectOptions(screen.getByLabelText('Country'), 'IN');

    await waitFor(() => expect(router.state.location.search).toBe('?country=IN'));
    await waitFor(() => expect(listRequests().at(-1)!.get('country')).toBe('IN'));
    expect(listRequests().at(-1)!.get('page')).toBe('1');
  });

  it('debounces the search box into a single request', async () => {
    const { router, listRequests, user } = setup('/employees');
    await screen.findByRole('link', { name: 'Bob Jones' });

    await user.type(screen.getByLabelText('Search'), 'smi');

    await waitFor(() => expect(router.state.location.search).toBe('?q=smi'));
    await waitFor(() => expect(listRequests().filter((p) => p.has('q'))).toHaveLength(1));
    expect(listRequests().at(-1)!.get('q')).toBe('smi');
  });

  it('sorts by clicking column headers', async () => {
    const { router, user } = setup('/employees');
    await screen.findByRole('link', { name: 'Bob Jones' });
    const nameHeader = screen.getByRole('columnheader', { name: /Employee/ });
    expect(nameHeader).toHaveAttribute('aria-sort', 'ascending');

    await user.click(within(nameHeader).getByRole('button'));
    await waitFor(() => expect(router.state.location.search).toBe('?sort=name%3Adesc'));

    // Pay columns sort highest first on the first click.
    await user.click(
      within(screen.getByRole('columnheader', { name: /Total \(USD\)/ })).getByRole('button'),
    );
    await waitFor(() => expect(router.state.location.search).toBe('?sort=totalUsd%3Adesc'));
  });

  it('pages forward', async () => {
    const { router, user } = setup('/employees', {
      body: page([bob, alice], { total: 60, totalPages: 3 }),
    });
    await screen.findByRole('link', { name: 'Bob Jones' });

    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Next page' }));

    await waitFor(() => expect(router.state.location.search).toBe('?page=2'));
  });

  it('links the CSV export to the current filters, without paging', async () => {
    setup('/employees?country=GB&level=L2&page=2');

    const link = await screen.findByRole('link', { name: 'Export CSV' });
    expect(link).toHaveAttribute(
      'href',
      '/api/employees/export?country=GB&level=L2&sort=name%3Aasc',
    );
  });

  it('shows an empty state with a way to clear filters', async () => {
    const { router, user } = setup('/employees?q=zzz', { body: page([]) });

    expect(await screen.findByText('No employees found')).toBeInTheDocument();
    expect(screen.getByText('Try a different search or clear the filters.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    await waitFor(() => expect(router.state.location.search).toBe(''));
  });

  it('shows an error with a retry button', async () => {
    setup('/employees', {
      status: 500,
      body: { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
    });

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("Couldn't load employees");
    expect(within(alert).getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
