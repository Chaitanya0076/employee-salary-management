import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';

export const BUCKET_OPTIONS = [5, 10, 15, 20] as const;
const DEFAULT_BUCKETS = 10;

export interface InsightParams {
  country: string;
  department: string;
  buckets: number;
}

export function parseInsightParams(search: URLSearchParams): InsightParams {
  const country = search.get('country') ?? '';
  const department = search.get('department') ?? '';
  const buckets = Number(search.get('buckets'));
  return {
    country: /^[A-Z]{2}$/i.test(country) ? country.toUpperCase() : '',
    department: /^\d+$/.test(department) ? department : '',
    buckets: (BUCKET_OPTIONS as readonly number[]).includes(buckets) ? buckets : DEFAULT_BUCKETS,
  };
}

export function toInsightSearch(params: InsightParams): URLSearchParams {
  const out = new URLSearchParams();
  if (params.country) out.set('country', params.country);
  if (params.department) out.set('department', params.department);
  if (params.buckets !== DEFAULT_BUCKETS) out.set('buckets', String(params.buckets));
  return out;
}

/** Insights filters live in the URL so a view can be shared or bookmarked. */
export function useInsightParams() {
  const [search, setSearch] = useSearchParams();
  const params = useMemo(() => parseInsightParams(search), [search]);
  const update = useCallback(
    (changes: Partial<InsightParams>) => setSearch(toInsightSearch({ ...params, ...changes })),
    [params, setSearch],
  );
  return { params, update };
}
