/**
 * Pure, deterministic seed-data generation. No database access, so it can be
 * unit tested and produces identical output for identical options.
 */
import {
  fakerDE,
  fakerEN,
  fakerEN_CA,
  fakerEN_GB,
  fakerEN_IN,
  fakerEN_US,
  type Faker,
} from '@faker-js/faker';
import {
  COUNTRIES,
  DEPARTMENTS,
  FX_RATES,
  LEVEL_CONFIG,
  LEVELS,
  baseSalaryBand,
  jobTitle,
  roundTo,
  type ComponentType,
  type CountryCode,
  type CountrySeed,
  type DepartmentSeed,
  type Level,
} from './reference-data.js';

export interface SeedOptions {
  employeeCount: number;
  seed: number;
  /** "Today" for the dataset: all dates are on or before it (ISO yyyy-mm-dd). */
  referenceDate: string;
}

export const DEFAULT_SEED_OPTIONS: SeedOptions = {
  employeeCount: 10_000,
  seed: 20_261_001,
  referenceDate: '2026-10-01',
};

export interface EmployeeRow {
  id: number;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string;
  level: Level;
  hireDate: string;
  status: 'ACTIVE' | 'INACTIVE';
  countryCode: CountryCode;
  departmentId: number;
}

export interface CompensationRow {
  id: number;
  employeeId: number;
  currency: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  reason: string;
}

export interface ComponentRow {
  compensationId: number;
  type: ComponentType;
  /** Exact decimal string with 2 places, e.g. "84500.00". */
  amount: string;
}

export interface SeedData {
  fxRates: { currency: string; rateToUsd: string }[];
  countries: { code: CountryCode; name: string; currency: string }[];
  departments: { id: number; name: string }[];
  employees: EmployeeRow[];
  compensations: CompensationRow[];
  components: ComponentRow[];
}

const NAME_FAKERS: Record<CountryCode, Faker> = {
  US: fakerEN_US,
  GB: fakerEN_GB,
  IN: fakerEN_IN,
  DE: fakerDE,
  CA: fakerEN_CA,
  SG: fakerEN,
};

const FIRST_HIRE_YEAR = 2015;
const INACTIVE_PROBABILITY = 0.04;
const BONUS_PROBABILITY = 0.85;
const ALLOWANCE_PROBABILITY = 0.6;
const PROMOTION_PROBABILITY = 0.15;
/** Annual review cycle: pay changes take effect on April 1st. */
const REVIEW_MONTH_DAY = '04-01';
/** New hires are not reviewed in their first ~6 months. */
const MIN_DAYS_BEFORE_FIRST_REVIEW = 180;

export function generateSeedData(options: SeedOptions = DEFAULT_SEED_OPTIONS): SeedData {
  const rng = fakerEN_US;
  rng.seed(options.seed);
  Object.values(NAME_FAKERS).forEach((f, i) => f !== rng && f.seed(options.seed + i + 1));

  const employees: EmployeeRow[] = [];
  const compensations: CompensationRow[] = [];
  const components: ComponentRow[] = [];
  const usedEmails = new Set<string>();

  for (let id = 1; id <= options.employeeCount; id++) {
    const country = weighted(rng, COUNTRIES);
    const department = weighted(rng, DEPARTMENTS);
    const level = weighted(
      rng,
      LEVELS.map((l) => ({ value: l, weight: LEVEL_CONFIG[l].weight })),
    ).value;
    const nameFaker = NAME_FAKERS[country.code];
    const firstName = nameFaker.person.firstName();
    const lastName = nameFaker.person.lastName();
    const hireDate = pickHireDate(rng, options.referenceDate);

    employees.push({
      id,
      employeeCode: `EMP-${String(id).padStart(5, '0')}`,
      firstName,
      lastName,
      email: uniqueEmail(firstName, lastName, usedEmails),
      jobTitle: jobTitle(level, department),
      level,
      hireDate,
      status: rng.datatype.boolean({ probability: INACTIVE_PROBABILITY }) ? 'INACTIVE' : 'ACTIVE',
      countryCode: country.code,
      departmentId: department.id,
    });

    const history = buildHistory(rng, {
      employeeId: id,
      firstCompensationId: compensations.length + 1,
      country,
      department,
      level,
      hireDate,
      referenceDate: options.referenceDate,
    });
    compensations.push(...history.compensations);
    components.push(...history.components);
  }

  return {
    fxRates: Object.entries(FX_RATES).map(([currency, rateToUsd]) => ({ currency, rateToUsd })),
    countries: COUNTRIES.map(({ code, name, currency }) => ({ code, name, currency })),
    departments: DEPARTMENTS.map(({ id, name }) => ({ id, name })),
    employees,
    compensations,
    components,
  };
}

interface HistoryInput {
  employeeId: number;
  firstCompensationId: number;
  country: CountrySeed;
  department: DepartmentSeed;
  level: Level;
  hireDate: string;
  referenceDate: string;
}

/**
 * Builds 1-3 contiguous, non-overlapping compensation records ending in an
 * open (current) record whose base pay sits inside the employee's band.
 * Earlier records are derived backwards by undoing annual raises.
 */
function buildHistory(rng: Faker, input: HistoryInput) {
  const reviewDates = eligibleReviewDates(input.hireDate, input.referenceDate);
  const recordCount = Math.min(
    weighted(rng, [
      { value: 1, weight: 30 },
      { value: 2, weight: 35 },
      { value: 3, weight: 35 },
    ]).value,
    reviewDates.length + 1,
  );
  // Most recent reviews; the first record always starts at the hire date.
  const starts = [input.hireDate, ...reviewDates.slice(reviewDates.length - (recordCount - 1))];

  const band = baseSalaryBand(input.country, input.level, input.department);
  const bases: number[] = [roundTo(rng.number.int({ min: band.min, max: band.max }), 100)];
  const reasons: string[] = [];
  for (let i = recordCount - 1; i > 0; i--) {
    const promoted = rng.datatype.boolean({ probability: PROMOTION_PROBABILITY });
    const raise = promoted
      ? rng.number.float({ min: 0.12, max: 0.2 })
      : rng.number.float({ min: 0.03, max: 0.1 });
    bases.unshift(roundTo(bases[0]! / (1 + raise), 100));
    reasons.unshift(promoted ? 'Promotion' : 'Annual review');
  }
  reasons.unshift('New hire');

  const bonusPct = rng.datatype.boolean({ probability: BONUS_PROBABILITY })
    ? LEVEL_CONFIG[input.level].bonusTarget * rng.number.float({ min: 0.8, max: 1.2 })
    : 0;
  const allowancePct = rng.datatype.boolean({ probability: ALLOWANCE_PROBABILITY })
    ? rng.number.float({ min: 0.03, max: 0.08 })
    : 0;

  const compensations: CompensationRow[] = [];
  const components: ComponentRow[] = [];
  starts.forEach((effectiveFrom, i) => {
    const id = input.firstCompensationId + i;
    const base = bases[i]!;
    compensations.push({
      id,
      employeeId: input.employeeId,
      currency: input.country.currency,
      effectiveFrom,
      effectiveTo: starts[i + 1] ?? null,
      reason: reasons[i]!,
    });
    components.push({ compensationId: id, type: 'BASE', amount: money(base) });
    if (bonusPct > 0) {
      components.push({
        compensationId: id,
        type: 'BONUS',
        amount: money(roundTo(base * bonusPct, 10)),
      });
    }
    if (allowancePct > 0) {
      components.push({
        compensationId: id,
        type: 'ALLOWANCE',
        amount: money(roundTo(base * allowancePct, 10)),
      });
    }
  });

  return { compensations, components };
}

/** April 1st review dates after a hire's probation and up to the reference date. */
export function eligibleReviewDates(hireDate: string, referenceDate: string): string[] {
  const earliest = addDays(hireDate, MIN_DAYS_BEFORE_FIRST_REVIEW);
  const dates: string[] = [];
  for (let year = Number(hireDate.slice(0, 4)); year <= Number(referenceDate.slice(0, 4)); year++) {
    const date = `${year}-${REVIEW_MONTH_DAY}`;
    if (date >= earliest && date <= referenceDate) dates.push(date);
  }
  return dates;
}

/** Hire dates skew towards recent years to mimic a growing company. */
function pickHireDate(rng: Faker, referenceDate: string): string {
  const lastYear = Number(referenceDate.slice(0, 4));
  const years = [];
  for (let y = FIRST_HIRE_YEAR; y <= lastYear; y++) {
    years.push({ value: y, weight: y - FIRST_HIRE_YEAR + 3 });
  }
  const year = weighted(rng, years).value;
  const start = `${year}-01-01`;
  const end = year === lastYear ? addDays(referenceDate, -1) : `${year}-12-31`;
  return addDays(start, rng.number.int({ min: 0, max: daysBetween(start, end) }));
}

function weighted<T extends { weight: number }>(rng: Faker, items: readonly T[]): T {
  return rng.helpers.weightedArrayElement(
    items.map((item) => ({ weight: item.weight, value: item })),
  );
}

function uniqueEmail(firstName: string, lastName: string, used: Set<string>): string {
  const local = `${slug(firstName)}.${slug(lastName)}`;
  let candidate = `${local}@acme.example`;
  for (let n = 2; used.has(candidate); n++) candidate = `${local}${n}@acme.example`;
  used.add(candidate);
  return candidate;
}

function slug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function money(value: number): string {
  return value.toFixed(2);
}

const DAY_MS = 86_400_000;

function addDays(isoDate: string, days: number): string {
  return new Date(Date.parse(`${isoDate}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}
