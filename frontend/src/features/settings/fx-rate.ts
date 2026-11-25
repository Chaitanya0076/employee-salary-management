/** Mirrors the API rule: positive, up to 10 integer digits and 8 decimals. */
const RATE_PATTERN = /^\d{1,10}(\.\d{1,8})?$/;

export const REPORTING_CURRENCY = 'USD';

export function validateRate(input: string): string | null {
  const value = input.trim();
  if (!value) return 'Enter a rate';
  if (!RATE_PATTERN.test(value)) return 'Use a number with up to 8 decimal places';
  if (Number(value) <= 0) return 'Must be greater than 0';
  return null;
}

/** "1.27000000" -> "1.27" for display and editing. */
export function trimRate(rate: string): string {
  return rate.includes('.') ? rate.replace(/0+$/, '').replace(/\.$/, '') : rate;
}

/** How much of the currency one US dollar buys (display only). */
export function inverseRate(rate: string): string {
  const n = Number(rate);
  return n > 0 ? (1 / n).toLocaleString('en-US', { maximumSignificantDigits: 5 }) : '—';
}
