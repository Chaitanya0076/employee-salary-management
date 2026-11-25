/**
 * Exact arithmetic on decimal money strings ("1234.5") using integer cents,
 * for client-side previews. The server remains the source of truth.
 */
export function toCents(amount: string): bigint {
  const [whole = '0', fraction = ''] = amount.trim().split('.');
  return BigInt(whole || '0') * 100n + BigInt((fraction + '00').slice(0, 2));
}

export function fromCents(cents: bigint): string {
  const sign = cents < 0n ? '-' : '';
  const abs = cents < 0n ? -cents : cents;
  return `${sign}${abs / 100n}.${String(abs % 100n).padStart(2, '0')}`;
}

export function sumAmounts(amounts: readonly string[]): string {
  return fromCents(amounts.reduce((acc, a) => acc + toCents(a), 0n));
}

/** Difference and percentage change (2 decimals), or null percent when `before` is 0. */
export function changeBetween(
  before: string,
  after: string,
): { amount: string; percent: string | null } {
  const b = toCents(before);
  const delta = toCents(after) - b;
  if (b === 0n) return { amount: fromCents(delta), percent: null };
  // Percent with 2 decimals, rounded half away from zero: delta / b * 100.
  const scaled = (delta * 100_000n) / b; // percent x 1000
  const rounded = scaled >= 0n ? (scaled + 5n) / 10n : (scaled - 5n) / 10n; // percent x 100
  return { amount: fromCents(delta), percent: fromCents(rounded) };
}

export const MONEY_PATTERN = /^\d{1,12}(\.\d{1,2})?$/;
