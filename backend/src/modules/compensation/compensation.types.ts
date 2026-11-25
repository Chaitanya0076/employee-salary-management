import type { EmployeeStatus } from '../../generated/prisma/enums.js';
import type { ComponentTypeName } from './compensation.rules.js';

export interface CompensationComponentDto {
  type: ComponentTypeName;
  /** Exact decimal string with 2 places. */
  amount: string;
}

/** One effective-dated pay record with totals in local currency and USD. */
export interface CompensationRecord {
  id: number;
  currency: string;
  effectiveFrom: string;
  /** Exclusive end date; null for the current record. */
  effectiveTo: string | null;
  reason: string | null;
  components: CompensationComponentDto[];
  base: string;
  total: string;
  /** Converted at today's static FX rate (there is no FX history; ADR-0005). */
  baseUsd: string;
  totalUsd: string;
  createdAt: string;
}

export interface CompensationHistory {
  employeeId: number;
  currency: string;
  current: CompensationRecord | null;
  /** Every record, newest first (the current one included). */
  history: CompensationRecord[];
}

export interface AmountChange {
  /** New minus previous, in local currency. */
  amount: string;
  /** Percentage change with 2 decimals; null if the previous amount was 0. */
  percent: string | null;
}

export interface PayChangeResult {
  compensation: CompensationRecord;
  previous: CompensationRecord;
  change: { base: AmountChange; total: AmountChange };
}

export interface PayChangeInput {
  effectiveFrom: string;
  components: CompensationComponentDto[];
  reason?: string | undefined;
}

/** What the rules see, read inside the transaction with the current record locked. */
export interface LockedPayState {
  employee: { id: number; status: EmployeeStatus; currency: string };
  current: { id: number; effectiveFrom: string; components: CompensationComponentDto[] } | null;
}

export interface NewCompensation {
  currency: string;
  effectiveFrom: string;
  reason: string | null;
  components: CompensationComponentDto[];
}
