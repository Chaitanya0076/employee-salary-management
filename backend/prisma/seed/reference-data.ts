/**
 * Static reference data and salary assumptions for the seed.
 * Figures are illustrative but plausible annual amounts in local currency.
 */

export type Level = 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'L6';
export type ComponentType = 'BASE' | 'BONUS' | 'ALLOWANCE';
export type CountryCode = 'US' | 'GB' | 'IN' | 'DE' | 'CA' | 'SG';

export const LEVELS: readonly Level[] = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6'];

/** Static FX-to-USD rates (ADR-0005). HR can edit these in the app. */
export const FX_RATES: Readonly<Record<string, string>> = {
  USD: '1.00000000',
  GBP: '1.27000000',
  EUR: '1.08000000',
  INR: '0.01200000',
  CAD: '0.73000000',
  SGD: '0.74000000',
};

export interface CountrySeed {
  code: CountryCode;
  name: string;
  currency: string;
  /** Share of headcount. */
  weight: number;
  /** Annual base pay range for an L1 employee at department multiplier 1.0. */
  l1Base: readonly [min: number, max: number];
}

export const COUNTRIES: readonly CountrySeed[] = [
  { code: 'US', name: 'United States', currency: 'USD', weight: 30, l1Base: [60_000, 80_000] },
  { code: 'IN', name: 'India', currency: 'INR', weight: 25, l1Base: [600_000, 900_000] },
  { code: 'GB', name: 'United Kingdom', currency: 'GBP', weight: 15, l1Base: [32_000, 42_000] },
  { code: 'DE', name: 'Germany', currency: 'EUR', weight: 12, l1Base: [45_000, 55_000] },
  { code: 'CA', name: 'Canada', currency: 'CAD', weight: 10, l1Base: [55_000, 70_000] },
  { code: 'SG', name: 'Singapore', currency: 'SGD', weight: 8, l1Base: [50_000, 65_000] },
];

export interface DepartmentSeed {
  id: number;
  name: string;
  weight: number;
  /** Pay premium/discount relative to the company baseline. */
  payMultiplier: number;
  /** Role noun used to build job titles, e.g. "Senior Software Engineer". */
  role: string;
}

export const DEPARTMENTS: readonly DepartmentSeed[] = [
  { id: 1, name: 'Engineering', weight: 35, payMultiplier: 1.1, role: 'Software Engineer' },
  { id: 2, name: 'Sales', weight: 15, payMultiplier: 1.0, role: 'Account Executive' },
  { id: 3, name: 'Customer Support', weight: 12, payMultiplier: 0.8, role: 'Support Specialist' },
  { id: 4, name: 'Operations', weight: 10, payMultiplier: 0.9, role: 'Operations Analyst' },
  { id: 5, name: 'Marketing', weight: 8, payMultiplier: 0.95, role: 'Marketing Specialist' },
  { id: 6, name: 'Product', weight: 8, payMultiplier: 1.1, role: 'Product Manager' },
  { id: 7, name: 'Finance', weight: 7, payMultiplier: 1.05, role: 'Financial Analyst' },
  { id: 8, name: 'Human Resources', weight: 5, payMultiplier: 0.9, role: 'HR Generalist' },
];

export interface LevelSeed {
  weight: number;
  /** Base pay multiplier relative to L1. */
  payMultiplier: number;
  /** Target bonus as a fraction of base. */
  bonusTarget: number;
}

export const LEVEL_CONFIG: Readonly<Record<Level, LevelSeed>> = {
  L1: { weight: 25, payMultiplier: 1.0, bonusTarget: 0.05 },
  L2: { weight: 30, payMultiplier: 1.35, bonusTarget: 0.08 },
  L3: { weight: 22, payMultiplier: 1.8, bonusTarget: 0.1 },
  L4: { weight: 13, payMultiplier: 2.4, bonusTarget: 0.15 },
  L5: { weight: 7, payMultiplier: 3.0, bonusTarget: 0.2 },
  L6: { weight: 3, payMultiplier: 4.0, bonusTarget: 0.25 },
};

export function jobTitle(level: Level, department: DepartmentSeed): string {
  switch (level) {
    case 'L1':
      return `Junior ${department.role}`;
    case 'L2':
      return department.role;
    case 'L3':
      return `Senior ${department.role}`;
    case 'L4':
      return `Lead ${department.role}`;
    case 'L5':
      return `${department.name} Manager`;
    case 'L6':
      return `Director of ${department.name}`;
  }
}

/** Inclusive base pay band for a country, level and department, rounded to 100. */
export function baseSalaryBand(
  country: CountrySeed,
  level: Level,
  department: DepartmentSeed,
): { min: number; max: number } {
  const factor = LEVEL_CONFIG[level].payMultiplier * department.payMultiplier;
  return {
    min: roundTo(country.l1Base[0] * factor, 100),
    max: roundTo(country.l1Base[1] * factor, 100),
  };
}

export function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}
