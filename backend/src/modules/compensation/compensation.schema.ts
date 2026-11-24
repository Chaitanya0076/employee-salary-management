import { z } from 'zod';
import { MoneyAmount } from '../../shared/utils/index.js';
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

export type ComponentInput = z.infer<typeof ComponentInput>;
