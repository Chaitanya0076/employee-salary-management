import type { Level } from '../../generated/prisma/enums.js';

export interface AnalyticsFilters {
  country?: string;
  departmentId?: number;
  level?: Level;
}

/** Money is an exact decimal string; null when there is no data. */
export interface PayStats {
  average: string | null;
  median: string | null;
  min: string | null;
  max: string | null;
}

export interface PaySummary {
  headcount: number;
  currency: 'USD';
  /** Annual total compensation (all components). */
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
  /** Base pay in the country's currency. */
  base: PayStats;
}

export interface DepartmentBreakdown {
  department: { id: number; name: string };
  headcount: number;
  totalPayUsd: string;
  /** Base pay in USD. */
  base: Pick<PayStats, 'average' | 'median'>;
}

export interface LevelBreakdown {
  level: Level;
  headcount: number;
  base: PayStats;
}

export interface HistogramBucket {
  /** Inclusive lower edge. */
  from: string;
  /** Exclusive upper edge (inclusive for the last bucket). */
  to: string;
  count: number;
}

export interface HeadcountYear {
  year: number;
  hires: number;
  cumulative: number;
}

/** Amounts are local when filtered to one country, otherwise USD equivalents. */
export interface CurrencyScoped<T> {
  currency: string;
  data: T;
}
