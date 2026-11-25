import { z } from 'zod';
import { Level } from '../../generated/prisma/enums.js';
import { CountryCode } from '../../shared/utils/index.js';

const country = CountryCode.optional();
const department = z.coerce.number().int().positive().optional();
const level = z.enum(Level).optional();

/** Each endpoint accepts only the filters that make sense for it (strict: typos are 400s). */
export const SummaryQuery = z.strictObject({ country, department });
export const ByCountryQuery = z.strictObject({ department });
export const ByDepartmentQuery = z.strictObject({ country });
export const ByLevelQuery = z.strictObject({ country, department });
export const DistributionQuery = z.strictObject({
  country,
  department,
  level,
  buckets: z.coerce.number().int().min(2).max(50).default(10),
});
export const HeadcountTrendQuery = z.strictObject({ country, department });

export type SummaryQuery = z.infer<typeof SummaryQuery>;
export type ByCountryQuery = z.infer<typeof ByCountryQuery>;
export type ByDepartmentQuery = z.infer<typeof ByDepartmentQuery>;
export type ByLevelQuery = z.infer<typeof ByLevelQuery>;
export type DistributionQuery = z.infer<typeof DistributionQuery>;
export type HeadcountTrendQuery = z.infer<typeof HeadcountTrendQuery>;
