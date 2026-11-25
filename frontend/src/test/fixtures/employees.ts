import type {
  CompensationHistory,
  EmployeeDetail,
  EmployeeListItem,
  Paginated,
} from '@/features/employees/types';

export const countries = [
  { code: 'GB', name: 'United Kingdom', currency: 'GBP' },
  { code: 'IN', name: 'India', currency: 'INR' },
  { code: 'US', name: 'United States', currency: 'USD' },
];

export const departments = [
  { id: 1, name: 'Engineering' },
  { id: 2, name: 'Sales' },
];

export const referenceHandlers = {
  'GET /api/countries': { body: { data: countries } },
  'GET /api/departments': { body: { data: departments } },
};

export const bob: EmployeeListItem = {
  id: 2,
  employeeCode: 'EMP-00002',
  firstName: 'Bob',
  lastName: 'Jones',
  email: 'bob.jones@acme.example',
  jobTitle: 'Account Executive',
  level: 'L2',
  status: 'ACTIVE',
  hireDate: '2021-03-01',
  country: { code: 'GB', name: 'United Kingdom' },
  department: { id: 2, name: 'Sales' },
  pay: {
    currency: 'GBP',
    base: '50000.00',
    total: '52000.00',
    baseUsd: '63500.00',
    totalUsd: '66040.00',
  },
};

export const alice: EmployeeListItem = {
  ...bob,
  id: 1,
  employeeCode: 'EMP-00001',
  firstName: 'Alice',
  lastName: 'Smith',
  email: 'alice.smith@acme.example',
  jobTitle: 'Senior Software Engineer',
  level: 'L3',
  hireDate: '2020-01-15',
  country: { code: 'US', name: 'United States' },
  department: { id: 1, name: 'Engineering' },
  pay: {
    currency: 'USD',
    base: '120000.00',
    total: '132000.00',
    baseUsd: '120000.00',
    totalUsd: '132000.00',
  },
};

export function page(
  data: EmployeeListItem[],
  meta: Partial<Paginated<EmployeeListItem>['meta']> = {},
) {
  return {
    data,
    meta: {
      page: 1,
      pageSize: 25,
      total: data.length,
      totalPages: Math.max(1, Math.ceil(data.length / 25)),
      ...meta,
    },
  };
}

const bobCurrent = {
  id: 2,
  currency: 'GBP',
  effectiveFrom: '2021-03-01',
  effectiveTo: null,
  reason: 'New hire',
  components: [
    { type: 'BASE' as const, amount: '50000.00' },
    { type: 'ALLOWANCE' as const, amount: '2000.00' },
  ],
  base: '50000.00',
  total: '52000.00',
  baseUsd: '63500.00',
  totalUsd: '66040.00',
  createdAt: '2026-01-01T00:00:00.000Z',
};

export const bobDetail: EmployeeDetail = {
  ...bob,
  country: { code: 'GB', name: 'United Kingdom', currency: 'GBP' },
  currentCompensation: bobCurrent,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

export const bobHistory: CompensationHistory = {
  employeeId: 2,
  currency: 'GBP',
  current: bobCurrent,
  history: [bobCurrent],
};
