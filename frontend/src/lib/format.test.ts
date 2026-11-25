import { describe, expect, it } from 'vitest';
import { formatDate, formatMoney, formatNumber, formatPercent } from './format';

describe('formatMoney', () => {
  it.each([
    ['120000.00', 'USD', '$120,000.00'],
    ['52000.5', 'GBP', '£52,000.50'],
    ['1500000.00', 'INR', '₹1,500,000.00'],
    ['90000', 'EUR', '€90,000.00'],
    [0, 'USD', '$0.00'],
  ])('formats %s %s as %s', (amount, currency, expected) => {
    expect(formatMoney(amount, currency)).toBe(expected);
  });

  it('formats compactly for tiles and charts', () => {
    expect(formatMoney('819144586.80', 'USD', { compact: true })).toBe('$819.1M');
    expect(formatMoney('63500', 'USD', { compact: true })).toBe('$63.5K');
  });

  it('respects a locale', () => {
    // Intl separates the symbol with a non-breaking space (U+00A0).
    expect(formatMoney('1234.5', 'EUR', { locale: 'de-DE' })).toBe('1.234,50\u00a0€');
  });

  it.each([null, undefined, '', 'abc'])('shows a dash for %j', (value) => {
    expect(formatMoney(value, 'USD')).toBe('—');
  });
});

describe('formatNumber', () => {
  it('groups thousands', () => {
    expect(formatNumber(9601)).toBe('9,601');
    expect(formatNumber(null)).toBe('—');
  });
});

describe('formatPercent', () => {
  it.each([
    ['9.62', '+9.62%'],
    ['-10.00', '-10.00%'],
    ['0', '0.00%'],
  ])('formats %s as %s', (value, expected) => {
    expect(formatPercent(value)).toBe(expected);
  });
});

describe('formatDate', () => {
  it('formats ISO dates without shifting the day', () => {
    expect(formatDate('2026-04-01')).toBe('Apr 1, 2026');
    expect(formatDate('2020-01-15T00:00:00.000Z')).toBe('Jan 15, 2020');
  });

  it('shows a dash for missing or invalid dates', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate('not-a-date')).toBe('—');
  });
});
