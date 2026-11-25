import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';

export interface Country {
  code: string;
  name: string;
  currency: string;
}

export interface Department {
  id: number;
  name: string;
}

export interface FxRate {
  currency: string;
  rateToUsd: string;
  updatedAt: string;
}

export const referenceKeys = {
  countries: ['reference', 'countries'] as const,
  departments: ['reference', 'departments'] as const,
  fxRates: ['reference', 'fx-rates'] as const,
};

const RARELY_CHANGES = 30 * 60_000;

export function useCountries() {
  return useQuery({
    queryKey: referenceKeys.countries,
    queryFn: async () => (await apiFetch<{ data: Country[] }>('/countries')).data,
    staleTime: RARELY_CHANGES,
  });
}

export function useDepartments() {
  return useQuery({
    queryKey: referenceKeys.departments,
    queryFn: async () => (await apiFetch<{ data: Department[] }>('/departments')).data,
    staleTime: RARELY_CHANGES,
  });
}
