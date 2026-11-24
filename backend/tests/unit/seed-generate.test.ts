import { describe, expect, it } from 'vitest';
import {
  eligibleReviewDates,
  generateSeedData,
  type CompensationRow,
  type SeedOptions,
} from '../../prisma/seed/generate.js';
import { COUNTRIES, DEPARTMENTS, baseSalaryBand } from '../../prisma/seed/reference-data.js';

// A smaller dataset keeps the suite fast; the rules are the same at 10,000.
const OPTIONS: SeedOptions = { employeeCount: 1_000, seed: 42, referenceDate: '2026-10-01' };
const data = generateSeedData(OPTIONS);

const countryByCode = new Map(COUNTRIES.map((c) => [c.code, c]));
const departmentById = new Map(DEPARTMENTS.map((d) => [d.id, d]));
const historyByEmployee = Map.groupBy(data.compensations, (c) => c.employeeId);
const componentsByCompensation = Map.groupBy(data.components, (c) => c.compensationId);

const baseOf = (comp: CompensationRow) =>
  Number(componentsByCompensation.get(comp.id)!.find((c) => c.type === 'BASE')!.amount);

describe('generateSeedData', () => {
  it('is deterministic for the same options', () => {
    expect(generateSeedData(OPTIONS)).toEqual(data);
  });

  it('produces different data for a different seed', () => {
    const other = generateSeedData({ ...OPTIONS, seed: 43 });
    expect(other.employees.map((e) => e.email)).not.toEqual(data.employees.map((e) => e.email));
  });

  it('creates the requested number of employees with unique codes and emails', () => {
    expect(data.employees).toHaveLength(OPTIONS.employeeCount);
    expect(new Set(data.employees.map((e) => e.employeeCode)).size).toBe(OPTIONS.employeeCount);
    expect(new Set(data.employees.map((e) => e.email)).size).toBe(OPTIONS.employeeCount);
    expect(data.employees[0]!.employeeCode).toBe('EMP-00001');
  });

  it('only references known countries and departments, and every currency has an FX rate', () => {
    const currencies = new Set(data.fxRates.map((r) => r.currency));
    for (const country of data.countries) expect(currencies).toContain(country.currency);
    for (const e of data.employees) {
      expect(countryByCode.has(e.countryCode)).toBe(true);
      expect(departmentById.has(e.departmentId)).toBe(true);
      expect(e.hireDate <= OPTIONS.referenceDate).toBe(true);
    }
  });

  it("keeps every employee's current base pay inside the band for country × level × department", () => {
    for (const e of data.employees) {
      const current = historyByEmployee.get(e.id)!.find((c) => c.effectiveTo === null)!;
      const band = baseSalaryBand(
        countryByCode.get(e.countryCode)!,
        e.level,
        departmentById.get(e.departmentId)!,
      );
      expect(baseOf(current)).toBeGreaterThanOrEqual(band.min);
      expect(baseOf(current)).toBeLessThanOrEqual(band.max);
    }
  });

  it('builds 1-3 contiguous, non-overlapping records per employee ending in one open record', () => {
    for (const e of data.employees) {
      const history = historyByEmployee.get(e.id)!;
      expect(history.length).toBeGreaterThanOrEqual(1);
      expect(history.length).toBeLessThanOrEqual(3);
      expect(history[0]!.effectiveFrom).toBe(e.hireDate);
      expect(history.filter((c) => c.effectiveTo === null)).toHaveLength(1);
      expect(history.at(-1)!.effectiveTo).toBeNull();

      history.forEach((record, i) => {
        expect(record.currency).toBe(countryByCode.get(e.countryCode)!.currency);
        expect(record.effectiveFrom <= OPTIONS.referenceDate).toBe(true);
        const next = history[i + 1];
        if (next) {
          expect(record.effectiveTo).toBe(next.effectiveFrom);
          expect(record.effectiveFrom < record.effectiveTo!).toBe(true);
        }
      });
    }
  });

  it("never lowers base pay over an employee's history", () => {
    for (const history of historyByEmployee.values()) {
      const bases = history.map(baseOf);
      expect(bases).toEqual([...bases].sort((a, b) => a - b));
    }
  });

  it('gives every compensation exactly one BASE, no duplicate types, and positive 2-decimal amounts', () => {
    for (const comp of data.compensations) {
      const components = componentsByCompensation.get(comp.id)!;
      const types = components.map((c) => c.type);
      expect(types.filter((t) => t === 'BASE')).toHaveLength(1);
      expect(new Set(types).size).toBe(types.length);
      for (const c of components) {
        expect(c.amount).toMatch(/^\d+\.\d{2}$/);
        expect(Number(c.amount)).toBeGreaterThan(0);
      }
    }
  });
});

describe('eligibleReviewDates', () => {
  it('returns April 1st reviews after a 180-day probation, up to the reference date', () => {
    expect(eligibleReviewDates('2023-01-15', '2026-10-01')).toEqual([
      '2024-04-01',
      '2025-04-01',
      '2026-04-01',
    ]);
  });

  it('skips a review that falls inside probation', () => {
    expect(eligibleReviewDates('2025-12-01', '2026-10-01')).toEqual([]);
  });

  it('excludes reviews after the reference date', () => {
    // 2024-04-01 is inside probation; 2026-04-01 is after the reference date.
    expect(eligibleReviewDates('2024-01-01', '2026-03-31')).toEqual(['2025-04-01']);
  });
});
