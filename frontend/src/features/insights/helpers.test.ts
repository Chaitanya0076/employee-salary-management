import { describe, expect, it } from 'vitest';
import { byCountry, byDepartment } from '@/test/fixtures/analytics';
import { inverseRate, trimRate, validateRate } from '@/features/settings/fx-rate';
import type { CountryBreakdown, DepartmentBreakdown } from './api';
import { countryBars, departmentBars, histogramBins } from './chart-data';
import { parseInsightParams, toInsightSearch } from './insight-params';

describe('chart data', () => {
  it('ranks countries by USD total and keeps local totals for the tooltip', () => {
    const bars = countryBars([...byCountry.data].reverse() as CountryBreakdown[]);

    expect(bars.map((b) => b.key)).toEqual(['US', 'IN']);
    expect(bars[1]).toMatchObject({ value: 42851902.2, tipLabel: '$42.9M' });
    expect(bars[1]!.tooltip).toEqual([
      { label: 'Total pay (USD)', value: '$42,851,902.20' },
      { label: 'Total pay (INR)', value: '₹3,570,991,850.00' },
      { label: 'Headcount', value: '2,470' },
    ]);
  });

  it('ranks departments by USD total', () => {
    expect(departmentBars(byDepartment.data as DepartmentBreakdown[]).map((b) => b.label)).toEqual([
      'Engineering',
      'Sales',
    ]);
  });

  it('labels histogram bins compactly in the given currency', () => {
    expect(histogramBins([{ from: '50000.00', to: '100000.00', count: 3 }], 'GBP')).toEqual([
      { label: '£50K–£100K', rangeLabel: '£50K – £100K', count: 3 },
    ]);
  });
});

describe('insight params', () => {
  it('reads valid values and ignores invalid ones', () => {
    expect(parseInsightParams(new URLSearchParams('country=in&department=2&buckets=20'))).toEqual({
      country: 'IN',
      department: '2',
      buckets: 20,
    });
    expect(parseInsightParams(new URLSearchParams('country=IND&department=x&buckets=7'))).toEqual({
      country: '',
      department: '',
      buckets: 10,
    });
  });

  it('omits defaults from the URL', () => {
    expect(toInsightSearch({ country: '', department: '', buckets: 10 }).toString()).toBe('');
  });
});

describe('fx rate helpers', () => {
  it('validates like the API', () => {
    expect(validateRate(' 1.27 ')).toBeNull();
    expect(validateRate('')).toBe('Enter a rate');
    expect(validateRate('0.000000001')).toBe('Use a number with up to 8 decimal places');
    expect(validateRate('0')).toBe('Must be greater than 0');
  });

  it('formats rates for display', () => {
    expect(trimRate('1.27000000')).toBe('1.27');
    expect(trimRate('1.00000000')).toBe('1');
    expect(inverseRate('0.01200000')).toBe('83.333');
  });
});
