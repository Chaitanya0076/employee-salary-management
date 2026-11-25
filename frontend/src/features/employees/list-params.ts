import { LEVELS, STATUSES, type EmployeeStatus, type Level } from './types';

export const SORT_FIELDS = ['name', 'employeeCode', 'hireDate', 'baseSalary', 'totalUsd'] as const;
export type SortField = (typeof SORT_FIELDS)[number];
export type SortDirection = 'asc' | 'desc';

export const PAGE_SIZES = [10, 25, 50, 100] as const;

/** The list view state. Kept in the URL so views are shareable and survive reload. */
export interface EmployeeListParams {
  page: number;
  pageSize: number;
  sort: SortField;
  direction: SortDirection;
  q: string;
  country: string;
  department: string;
  level: Level | '';
  status: EmployeeStatus | '';
}

export const DEFAULT_LIST_PARAMS: EmployeeListParams = {
  page: 1,
  pageSize: 25,
  sort: 'name',
  direction: 'asc',
  q: '',
  country: '',
  department: '',
  level: '',
  status: '',
};

function positiveInt(
  value: string | null,
  fallback: number,
  max = Number.MAX_SAFE_INTEGER,
): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= max ? n : fallback;
}

/** Reads list state from the URL, ignoring anything invalid (falls back to defaults). */
export function parseListParams(search: URLSearchParams): EmployeeListParams {
  const d = DEFAULT_LIST_PARAMS;
  const [sortField, sortDirection] = (search.get('sort') ?? '').split(':');
  const pageSize = positiveInt(search.get('pageSize'), d.pageSize);
  const level = search.get('level') ?? '';
  const status = search.get('status') ?? '';
  return {
    page: positiveInt(search.get('page'), d.page),
    pageSize: (PAGE_SIZES as readonly number[]).includes(pageSize) ? pageSize : d.pageSize,
    sort: (SORT_FIELDS as readonly string[]).includes(sortField ?? '')
      ? (sortField as SortField)
      : d.sort,
    direction: sortDirection === 'desc' ? 'desc' : 'asc',
    q: (search.get('q') ?? '').slice(0, 100),
    country: /^[A-Z]{2}$/i.test(search.get('country') ?? '')
      ? search.get('country')!.toUpperCase()
      : '',
    department: /^\d+$/.test(search.get('department') ?? '') ? search.get('department')! : '',
    level: (LEVELS as readonly string[]).includes(level) ? (level as Level) : '',
    status: (STATUSES as readonly string[]).includes(status) ? (status as EmployeeStatus) : '',
  };
}

/** Writes list state to URL params, omitting defaults so URLs stay short. */
export function toSearchParams(params: EmployeeListParams): URLSearchParams {
  const d = DEFAULT_LIST_PARAMS;
  const out = new URLSearchParams();
  if (params.q.trim()) out.set('q', params.q.trim());
  if (params.country) out.set('country', params.country);
  if (params.department) out.set('department', params.department);
  if (params.level) out.set('level', params.level);
  if (params.status) out.set('status', params.status);
  if (params.sort !== d.sort || params.direction !== d.direction)
    out.set('sort', `${params.sort}:${params.direction}`);
  if (params.pageSize !== d.pageSize) out.set('pageSize', String(params.pageSize));
  if (params.page !== d.page) out.set('page', String(params.page));
  return out;
}

/** The API query for the list (and, without paging, for the CSV export). */
export function toApiQuery(params: EmployeeListParams, { paging = true } = {}) {
  return {
    q: params.q.trim() || undefined,
    country: params.country || undefined,
    department: params.department || undefined,
    level: params.level || undefined,
    status: params.status || undefined,
    sort: `${params.sort}:${params.direction}`,
    ...(paging ? { page: params.page, pageSize: params.pageSize } : {}),
  };
}

export function hasActiveFilters(params: EmployeeListParams): boolean {
  return Boolean(params.q || params.country || params.department || params.level || params.status);
}
