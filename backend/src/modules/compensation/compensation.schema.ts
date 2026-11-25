import { z } from 'zod';
import { IdParam, MoneyAmount } from '../../shared/utils/index.js';
import { COMPONENT_TYPES, componentIssues } from './compensation.rules.js';

export const ComponentInput = z.strictObject({
  type: z.enum(COMPONENT_TYPES),
  amount: MoneyAmount,
});

export const ComponentsInput = z
  .array(ComponentInput)
  .min(1, 'At least one component is required')
  .max(COMPONENT_TYPES.length)
  .superRefine((components, ctx) => {
    for (const issue of componentIssues(components)) {
      ctx.addIssue({ code: 'custom', path: issue.path, message: issue.message });
    }
  });

export const EmployeeCompensationParams = z.object({ id: IdParam });

export const PayChangeBody = z.strictObject({
  effectiveFrom: z.iso.date('Must be a date in YYYY-MM-DD format'),
  components: ComponentsInput,
  reason: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => v || undefined),
});

export type ComponentInput = z.infer<typeof ComponentInput>;
export type EmployeeCompensationParams = z.infer<typeof EmployeeCompensationParams>;
export type PayChangeBody = z.infer<typeof PayChangeBody>;
