import { describe, expect, it } from 'vitest';
import {
  convertAmount,
  csvCell,
  csvRow,
  sumAmounts,
  toMoneyString,
} from '../../src/shared/utils/index.js';

describe('csvCell', () => {
  it.each([
    ['plain text', 'Alice', 'Alice'],
    ['a number', 1234.5, '1234.5'],
    ['null', null, ''],
    ['undefined', undefined, ''],
    ['a comma', 'Smith, Jr.', '"Smith, Jr."'],
    ['quotes', 'The "Boss"', '"The ""Boss"""'],
    ['a newline', 'line1\nline2', '"line1\nline2"'],
    ['unicode', 'Müller', 'Müller'],
  ])('handles %s', (_label, input, expected) => {
    expect(csvCell(input)).toBe(expected);
  });

  it.each(['=SUM(A1:A9)', '+1', '-1+2', '@cmd', '\tx', '\rx'])(
    'neutralises the formula trigger in %j',
    (input) => {
      expect(csvCell(input).replace(/^"/, '').startsWith(`'`)).toBe(true);
    },
  );

  it('quotes and escapes a neutralised formula that also contains quotes', () => {
    expect(csvCell('=HYPERLINK("http://x")')).toBe(`"'=HYPERLINK(""http://x"")"`);
  });

  it('leaves numbers untouched, including negative ones', () => {
    expect(csvCell(-5)).toBe('-5');
  });
});

describe('csvRow', () => {
  it('joins cells with commas and ends with CRLF', () => {
    expect(csvRow(['a', 1, null, 'b,c'])).toBe('a,1,,"b,c"\r\n');
  });
});

describe('money', () => {
  it('formats with exactly 2 decimals', () => {
    expect(toMoneyString('1200000.5')).toBe('1200000.50');
    expect(toMoneyString(0)).toBe('0.00');
  });

  it('adds exactly, without floating point error', () => {
    expect(toMoneyString(sumAmounts(['0.10', '0.20']))).toBe('0.30');
  });

  it('converts with an FX rate, rounding half up to cents', () => {
    expect(toMoneyString(convertAmount('1260000.50', '0.012'))).toBe('15120.01');
    expect(toMoneyString(convertAmount('0.125', '1'))).toBe('0.13');
  });
});
