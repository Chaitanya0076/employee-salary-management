import { z } from 'zod';
import { CurrencyCode } from '../../shared/utils/index.js';

export const FxRateParams = z.object({ currency: CurrencyCode });

/** Rate to USD as NUMERIC(18,8): positive, up to 10 integer digits and 8 decimals. */
export const UpdateFxRateBody = z.strictObject({
  rateToUsd: z
    .union([z.string().trim(), z.number()])
    .transform(String)
    .pipe(
      z.string().regex(/^\d{1,10}(\.\d{1,8})?$/, 'Must be a number with at most 8 decimal places'),
    )
    .refine((v) => Number(v) > 0, 'Must be greater than 0'),
});

export type FxRateParams = z.infer<typeof FxRateParams>;
export type UpdateFxRateBody = z.infer<typeof UpdateFxRateBody>;
