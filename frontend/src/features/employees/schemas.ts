/**
 * Client-side validation mirroring the API rules (docs/data-model.md), so most
 * mistakes are caught before a round trip. The server still validates everything.
 */
import { z } from 'zod';
import { MONEY_PATTERN } from '@/lib/money';
import { COMPONENT_TYPES, LEVELS } from './types';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const moneyAmount = z
  .string()
  .trim()
  .min(1, 'Enter an amount')
  .regex(MONEY_PATTERN, 'Use a number with up to 2 decimal places')
  .refine((v) => Number(v) > 0, 'Must be greater than 0');

export const componentsSchema = z
  .array(z.object({ type: z.enum(COMPONENT_TYPES), amount: moneyAmount }))
  .min(1, 'Add at least a base salary')
  .superRefine((components, ctx) => {
    if (!components.some((c) => c.type === 'BASE')) {
      ctx.addIssue({ code: 'custom', message: 'A base salary is required' });
    }
    const seen = new Set<string>();
    components.forEach((c, i) => {
      if (seen.has(c.type)) {
        ctx.addIssue({
          code: 'custom',
          path: [i, 'type'],
          message: 'Each component can only be added once',
        });
      }
      seen.add(c.type);
    });
  });

const name = (label: string) => z.string().trim().min(1, `${label} is required`).max(100);

const profileFields = {
  firstName: name('First name'),
  lastName: name('Last name'),
  email: z.string().trim().min(1, 'Email is required').pipe(z.email('Enter a valid email address')),
  jobTitle: z.string().trim().min(1, 'Job title is required').max(150),
  level: z.enum(LEVELS, { error: 'Select a level' }),
  departmentId: z.string().min(1, 'Select a department'),
};

export function createEmployeeSchema(today: string) {
  return z.object({
    ...profileFields,
    hireDate: z
      .string()
      .regex(ISO_DATE, 'Enter the hire date')
      .refine((d) => d <= today, 'Hire date cannot be in the future'),
    countryCode: z.string().min(1, 'Select a country'),
    components: componentsSchema,
  });
}

export const editEmployeeSchema = z.object(profileFields);

export function payChangeSchema(today: string, currentFrom: string | null) {
  return z.object({
    effectiveFrom: z
      .string()
      .regex(ISO_DATE, 'Enter the date the change takes effect')
      .refine((d) => d <= today, 'Pay changes cannot be future-dated')
      .refine((d) => !currentFrom || d > currentFrom, {
        message: `Must be after the current pay's start date${currentFrom ? ` (${currentFrom})` : ''}`,
      }),
    components: componentsSchema,
    reason: z.string().trim().max(200, 'Keep the reason under 200 characters'),
  });
}

export type CreateEmployeeForm = z.infer<ReturnType<typeof createEmployeeSchema>>;
export type EditEmployeeForm = z.infer<typeof editEmployeeSchema>;
export type PayChangeForm = z.infer<ReturnType<typeof payChangeSchema>>;
