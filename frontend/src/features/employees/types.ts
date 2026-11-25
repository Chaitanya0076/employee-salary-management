export const LEVELS = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6'] as const;
export type Level = (typeof LEVELS)[number];

export const STATUSES = ['ACTIVE', 'INACTIVE'] as const;
export type EmployeeStatus = (typeof STATUSES)[number];

export const COMPONENT_TYPES = ['BASE', 'BONUS', 'ALLOWANCE'] as const;
export type ComponentType = (typeof COMPONENT_TYPES)[number];

export const COMPONENT_LABELS: Record<ComponentType, string> = {
  BASE: 'Base salary',
  BONUS: 'Bonus',
  ALLOWANCE: 'Allowance',
};

export const LEVEL_LABELS: Record<Level, string> = {
  L1: 'L1 · Junior',
  L2: 'L2 · Mid',
  L3: 'L3 · Senior',
  L4: 'L4 · Lead',
  L5: 'L5 · Manager',
  L6: 'L6 · Director',
};

/** Money values are exact decimal strings from the API. */
export interface PaySummary {
  currency: string;
  base: string;
  total: string;
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

export interface CompensationComponent {
  type: ComponentType;
  amount: string;
}

export interface CompensationRecord extends PaySummary {
  id: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  reason: string | null;
  components: CompensationComponent[];
  createdAt: string;
}

export interface EmployeeDetail extends Omit<EmployeeListItem, 'pay' | 'country'> {
  country: { code: string; name: string; currency: string };
  currentCompensation: CompensationRecord | null;
  createdAt: string;
  updatedAt: string;
}

export interface CompensationHistory {
  employeeId: number;
  currency: string;
  current: CompensationRecord | null;
  history: CompensationRecord[];
}

export interface AmountChange {
  amount: string;
  percent: string | null;
}

export interface PayChangeResult {
  compensation: CompensationRecord;
  previous: CompensationRecord;
  change: { base: AmountChange; total: AmountChange };
}

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PageMeta;
}

export interface NewEmployeeInput {
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string;
  level: Level;
  hireDate: string;
  countryCode: string;
  departmentId: number;
  compensation: { components: CompensationComponent[] };
}

export type EmployeeChanges = Partial<
  Pick<
    NewEmployeeInput,
    'firstName' | 'lastName' | 'email' | 'jobTitle' | 'level' | 'departmentId'
  > & {
    status: EmployeeStatus;
  }
>;

export interface PayChangeInput {
  effectiveFrom: string;
  components: CompensationComponent[];
  reason?: string;
}
