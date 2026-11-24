import { z } from 'zod';

/** Positive money amount, max NUMERIC(14,2): accepts "1234.5" or 1234.5, normalised to a string. */
export const MoneyAmount = z
  .union([z.string().trim(), z.number()])
  .transform(String)
  .pipe(
    z
      .string()
      .regex(
        /^\d{1,12}(\.\d{1,2})?$/,
        'Must be a number with at most 12 digits and 2 decimal places',
      ),
  )
  .refine((v) => Number(v) > 0, 'Must be greater than 0');

export const IdParam = z.coerce.number().int().positive().max(2_147_483_647);

export const CountryCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}$/, 'Must be a 2-letter ISO country code');

export const CurrencyCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, 'Must be a 3-letter ISO currency code');
