import { Prisma } from '../../generated/prisma/client.js';

/**
 * Exact decimal arithmetic for money (decimal.js via Prisma). Amounts leave the
 * API as strings with 2 decimal places so no precision is lost in JSON.
 */
export type Decimal = Prisma.Decimal;
export type DecimalInput = Prisma.Decimal | string | number;

export function toMoneyString(value: DecimalInput): string {
  return new Prisma.Decimal(value).toFixed(2, Prisma.Decimal.ROUND_HALF_UP);
}

export function sumAmounts(values: readonly DecimalInput[]): Prisma.Decimal {
  return values.reduce<Prisma.Decimal>((acc, v) => acc.plus(v), new Prisma.Decimal(0));
}

/** Converts an amount with a reporting FX rate, rounded half-up to cents. */
export function convertAmount(amount: DecimalInput, rate: DecimalInput): Prisma.Decimal {
  return new Prisma.Decimal(amount).times(rate).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}
