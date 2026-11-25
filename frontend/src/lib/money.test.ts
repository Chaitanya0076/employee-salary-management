import { describe, expect, it } from 'vitest';
import { changeBetween, fromCents, sumAmounts, toCents } from './money';

describe('money helpers', () => {
  it('converts between decimal strings and cents exactly', () => {
    expect(toCents('1234.5')).toBe(123450n);
    expect(toCents('0.07')).toBe(7n);
    expect(toCents('50000')).toBe(5000000n);
    expect(fromCents(-500n)).toBe('-5.00');
  });

  it('adds without floating point error', () => {
    expect(sumAmounts(['0.10', '0.20'])).toBe('0.30');
    expect(sumAmounts(['50000', '2000.50'])).toBe('52000.50');
  });

  it.each([
    ['50000.00', '55000', { amount: '5000.00', percent: '10.00' }],
    ['52000.00', '57000', { amount: '5000.00', percent: '9.62' }],
    ['50000.00', '45000', { amount: '-5000.00', percent: '-10.00' }],
    ['0', '100', { amount: '100.00', percent: null }],
  ])('changeBetween(%s, %s)', (before, after, expected) => {
    expect(changeBetween(before, after)).toEqual(expected);
  });
});
