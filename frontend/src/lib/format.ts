/**
 * Display formatting. Amounts arrive from the API as exact decimal strings;
 * they are converted to numbers only here, for display.
 */
export const DEFAULT_LOCALE = 'en-US';
const EMPTY = '—';

const formatters = new Map<string, Intl.NumberFormat>();

function numberFormat(locale: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, options);
    formatters.set(key, formatter);
  }
  return formatter;
}

type Amount = string | number | null | undefined;

function toNumber(value: Amount): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export interface MoneyOptions {
  /** "$1.2M" style, for charts and summary tiles. */
  compact?: boolean;
  locale?: string;
}

export function formatMoney(amount: Amount, currency: string, options: MoneyOptions = {}): string {
  const n = toNumber(amount);
  if (n === null) return EMPTY;
  const { compact = false, locale = DEFAULT_LOCALE } = options;
  return numberFormat(locale, {
    style: 'currency',
    currency,
    notation: compact ? 'compact' : 'standard',
    minimumFractionDigits: compact ? 0 : 2,
    maximumFractionDigits: compact ? 1 : 2,
  }).format(n);
}

export function formatNumber(value: Amount, locale = DEFAULT_LOCALE): string {
  const n = toNumber(value);
  return n === null ? EMPTY : numberFormat(locale, { maximumFractionDigits: 0 }).format(n);
}

/** "9.62" -> "+9.62%", "-10" -> "-10.00%". */
export function formatPercent(value: Amount, locale = DEFAULT_LOCALE): string {
  const n = toNumber(value);
  if (n === null) return EMPTY;
  return numberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: 'exceptZero',
  }).format(n / 100);
}

/** ISO date (yyyy-mm-dd) -> "Apr 1, 2026". Formatted in UTC so the day never shifts. */
export function formatDate(isoDate: string | null | undefined, locale = DEFAULT_LOCALE): string {
  if (!isoDate) return EMPTY;
  const date = new Date(`${isoDate.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return EMPTY;
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(date);
}
