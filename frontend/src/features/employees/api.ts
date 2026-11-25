import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, buildUrl } from '@/lib/api-client';
import { toApiQuery, type EmployeeListParams } from './list-params';
import type {
  CompensationHistory,
  EmployeeChanges,
  EmployeeDetail,
  EmployeeListItem,
  NewEmployeeInput,
  Paginated,
  PayChangeInput,
  PayChangeResult,
} from './types';

export const employeeKeys = {
  all: ['employees'] as const,
  list: (params: EmployeeListParams) => ['employees', 'list', params] as const,
  detail: (id: number) => ['employees', 'detail', id] as const,
  compensation: (id: number) => ['employees', 'compensation', id] as const,
};

export function useEmployeeList(params: EmployeeListParams) {
  return useQuery({
    queryKey: employeeKeys.list(params),
    queryFn: () =>
      apiFetch<Paginated<EmployeeListItem>>('/employees', { query: toApiQuery(params) }),
    // Keep showing the current page while the next one loads (no flashing table).
    placeholderData: keepPreviousData,
  });
}

/** Same-origin URL; the browser sends the session cookie and downloads the streamed CSV. */
export function exportCsvUrl(params: EmployeeListParams): string {
  return buildUrl('/employees/export', toApiQuery(params, { paging: false }));
}

export function useEmployee(id: number) {
  return useQuery({
    queryKey: employeeKeys.detail(id),
    queryFn: () => apiFetch<EmployeeDetail>(`/employees/${id}`),
  });
}

export function useCompensationHistory(id: number) {
  return useQuery({
    queryKey: employeeKeys.compensation(id),
    queryFn: () => apiFetch<CompensationHistory>(`/employees/${id}/compensation`),
  });
}

/** Pay and headcount feed the insights too, so writes refresh both. */
function useInvalidateAfterWrite() {
  const client = useQueryClient();
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: employeeKeys.all }),
      client.invalidateQueries({ queryKey: ['analytics'] }),
    ]);
}

export function useCreateEmployee() {
  const invalidate = useInvalidateAfterWrite();
  return useMutation({
    mutationFn: (input: NewEmployeeInput) =>
      apiFetch<EmployeeDetail>('/employees', { method: 'POST', body: input }),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateEmployee(id: number) {
  const invalidate = useInvalidateAfterWrite();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (changes: EmployeeChanges) =>
      apiFetch<EmployeeDetail>(`/employees/${id}`, { method: 'PATCH', body: changes }),
    onSuccess: (employee) => {
      client.setQueryData(employeeKeys.detail(id), employee);
      return invalidate();
    },
  });
}

export function useChangePay(id: number) {
  const invalidate = useInvalidateAfterWrite();
  return useMutation({
    mutationFn: (input: PayChangeInput) =>
      apiFetch<PayChangeResult>(`/employees/${id}/compensation`, { method: 'POST', body: input }),
    onSuccess: () => invalidate(),
  });
}
