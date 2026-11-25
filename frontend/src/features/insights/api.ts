import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiFetch, type QueryValue } from '@/lib/api-client';
import type { Level } from '@/features/employees/types';

/** Money values are exact decimal strings. */
export interface PayStats {
  average: string | null;
  median: string | null;
  min: string | null;
  max: string | null;
}

export interface PaySummary {
  headcount: number;
  currency: 'USD';
  totalPay: string;
  averagePay: string | null;
  medianPay: string | null;
}

export interface CountryBreakdown {
  country: { code: string; name: string };
  currency: string;
  headcount: number;
  totalPay: string;
  totalPayUsd: string;
  base: PayStats;
}

export interface DepartmentBreakdown {
  department: { id: number; name: string };
  headcount: number;
  totalPayUsd: string;
  base: Pick<PayStats, 'average' | 'median'>;
}

export interface LevelBreakdown {
  level: Level;
  headcount: number;
  base: PayStats;
}

export interface HistogramBucket {
  from: string;
  to: string;
  count: number;
}

export interface HeadcountYear {
  year: number;
  hires: number;
  cumulative: number;
}

export interface InsightFilters {
  country?: string;
  department?: string;
}

function useAnalytics<T>(name: string, query: Record<string, QueryValue>) {
  return useQuery({
    queryKey: ['analytics', name, query],
    queryFn: () => apiFetch<T>(`/analytics/${name}`, { query }),
    // Keep the previous chart on screen while a new filter loads.
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

export const useSummary = (f: InsightFilters = {}) =>
  useAnalytics<PaySummary>('summary', { country: f.country, department: f.department });

export const useByCountry = (f: Pick<InsightFilters, 'department'> = {}) =>
  useAnalytics<{ data: CountryBreakdown[] }>('by-country', { department: f.department });

export const useByDepartment = (f: Pick<InsightFilters, 'country'> = {}) =>
  useAnalytics<{ currency: 'USD'; data: DepartmentBreakdown[] }>('by-department', {
    country: f.country,
  });

export const useByLevel = (f: InsightFilters = {}) =>
  useAnalytics<{ currency: string; data: LevelBreakdown[] }>('by-level', {
    country: f.country,
    department: f.department,
  });

export const useDistribution = (f: InsightFilters, buckets: number) =>
  useAnalytics<{ currency: string; data: HistogramBucket[] }>('distribution', {
    country: f.country,
    department: f.department,
    buckets,
  });

export const useHeadcountTrend = (f: InsightFilters = {}) =>
  useAnalytics<{ data: HeadcountYear[] }>('headcount-trend', {
    country: f.country,
    department: f.department,
  });
