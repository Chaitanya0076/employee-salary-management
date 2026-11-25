import type { EmployeeStatus, Level } from '../../generated/prisma/enums.js';
import type {
  CompensationComponentDto,
  CompensationRecord,
} from '../compensation/compensation.types.js';

export type { EmployeeStatus, Level };

/** Current pay at a glance. Money is an exact decimal string. */
export interface PaySummary {
  currency: string;
  base: string;
  total: string;
  /** Base converted with the static FX table; comparable across countries. */
  baseUsd: string;
  totalUsd: string;
}

export interface EmployeeListItem {
  id: number;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string;
  level: Level;
  status: EmployeeStatus;
  hireDate: string;
  country: { code: string; name: string };
  department: { id: number; name: string };
  pay: PaySummary | null;
}

export interface EmployeeDetail extends Omit<EmployeeListItem, 'pay' | 'country'> {
  country: { code: string; name: string; currency: string };
  currentCompensation: CompensationRecord | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeFilters {
  q?: string;
  country?: string;
  departmentId?: number;
  level?: Level;
  status?: EmployeeStatus;
}

export const SORT_FIELDS = ['name', 'employeeCode', 'hireDate', 'baseSalary', 'totalUsd'] as const;
export type SortField = (typeof SORT_FIELDS)[number];
export type SortDirection = 'asc' | 'desc';

export interface EmployeeSort {
  field: SortField;
  direction: SortDirection;
}

export interface EmployeeIdentity {
  id: number;
  email: string;
  countryCode: string;
}

/** Input to the repository for a new employee and their initial pay. */
export interface NewEmployeeRecord {
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string;
  level: Level;
  hireDate: string;
  countryCode: string;
  departmentId: number;
  compensation: {
    currency: string;
    effectiveFrom: string;
    reason: string;
    components: CompensationComponentDto[];
  };
}

export interface EmployeeChanges {
  firstName?: string;
  lastName?: string;
  email?: string;
  jobTitle?: string;
  level?: Level;
  departmentId?: number;
  status?: EmployeeStatus;
}
