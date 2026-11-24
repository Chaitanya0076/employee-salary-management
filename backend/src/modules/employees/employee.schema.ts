import { z } from 'zod';
import { EmployeeStatus, Level } from '../../generated/prisma/enums.js';
import { CountryCode, IdParam, PageQuery } from '../../shared/utils/index.js';
import { ComponentsInput } from '../compensation/compensation.schema.js';
import { SORT_FIELDS, type EmployeeSort, type SortField } from './employee.types.js';

export const DEFAULT_SORT: EmployeeSort = { field: 'name', direction: 'asc' };

/** Parses "field:direction" (direction optional, default asc). Returns null if invalid. */
export function parseSort(value: string): EmployeeSort | null {
  const [field, direction = 'asc', ...rest] = value.split(':');
  if (rest.length > 0) return null;
  if (!SORT_FIELDS.includes(field as SortField)) return null;
  if (direction !== 'asc' && direction !== 'desc') return null;
  return { field: field as SortField, direction };
}

const SortParam = z
  .string()
  .trim()
  .optional()
  .transform((value, ctx) => {
    if (!value) return DEFAULT_SORT;
    const sort = parseSort(value);
    if (!sort) {
      ctx.addIssue({
        code: 'custom',
        message: `Must be one of ${SORT_FIELDS.join(', ')}, optionally followed by :asc or :desc`,
      });
      return z.NEVER;
    }
    return sort;
  });

const FilterQuery = {
  q: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((v) => v || undefined),
  country: CountryCode.optional(),
  department: z.coerce.number().int().positive().optional(),
  level: z.enum(Level).optional(),
  status: z.enum(EmployeeStatus).optional(),
  sort: SortParam,
};

/** Unknown query parameters are rejected so typos (e.g. "departmnt") don't silently match everything. */
export const ListEmployeesQuery = z.strictObject({ ...FilterQuery, ...PageQuery });
export const ExportEmployeesQuery = z.strictObject(FilterQuery);
export const EmployeeIdParams = z.object({ id: IdParam });

const Name = z.string().trim().min(1, 'Required').max(100);
const Email = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address').max(254));
const JobTitle = z.string().trim().min(1, 'Required').max(150);

export const CreateEmployeeBody = z.strictObject({
  firstName: Name,
  lastName: Name,
  email: Email,
  jobTitle: JobTitle,
  level: z.enum(Level),
  hireDate: z.iso.date('Must be a date in YYYY-MM-DD format'),
  countryCode: CountryCode,
  departmentId: z.number().int().positive(),
  /** Initial pay; it starts on the hire date, in the country's currency. */
  compensation: z.strictObject({ components: ComponentsInput }),
});

export const UpdateEmployeeBody = z
  .strictObject({
    firstName: Name,
    lastName: Name,
    email: Email,
    jobTitle: JobTitle,
    level: z.enum(Level),
    departmentId: z.number().int().positive(),
    status: z.enum(EmployeeStatus),
    /** Accepted only so a clear "cannot change country" error can be returned. */
    countryCode: CountryCode,
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, 'Provide at least one field to update');

export type ListEmployeesQuery = z.infer<typeof ListEmployeesQuery>;
export type ExportEmployeesQuery = z.infer<typeof ExportEmployeesQuery>;
export type EmployeeIdParams = z.infer<typeof EmployeeIdParams>;
export type CreateEmployeeBody = z.infer<typeof CreateEmployeeBody>;
export type UpdateEmployeeBody = z.infer<typeof UpdateEmployeeBody>;
