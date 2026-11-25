import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import {
  DEFAULT_LIST_PARAMS,
  parseListParams,
  toSearchParams,
  type EmployeeListParams,
} from './list-params';

/** List state backed by the URL query string. */
export function useListParams() {
  const [searchParams, setSearchParams] = useSearchParams();
  const params = useMemo(() => parseListParams(searchParams), [searchParams]);

  const update = useCallback(
    (changes: Partial<EmployeeListParams>) => {
      // Any change other than paging starts again from page 1.
      const resetsPage = Object.keys(changes).some((k) => k !== 'page');
      const next = {
        ...params,
        ...changes,
        ...(resetsPage && !('page' in changes) ? { page: 1 } : {}),
      };
      // Typing in search shouldn't flood the back button; other changes are real history entries.
      setSearchParams(toSearchParams(next), { replace: 'q' in changes });
    },
    [params, setSearchParams],
  );

  const reset = useCallback(
    () =>
      setSearchParams(
        toSearchParams({
          ...DEFAULT_LIST_PARAMS,
          sort: params.sort,
          direction: params.direction,
          pageSize: params.pageSize,
        }),
      ),
    [params, setSearchParams],
  );

  return { params, update, reset };
}
