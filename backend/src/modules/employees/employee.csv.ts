import { UTF8_BOM, csvRow } from '../../shared/utils/index.js';
import type { EmployeeListItem } from './employee.types.js';

export const EMPLOYEE_CSV_HEADER = [
  'Employee Code',
  'First Name',
  'Last Name',
  'Email',
  'Job Title',
  'Level',
  'Status',
  'Hire Date',
  'Country',
  'Department',
  'Currency',
  'Base Salary',
  'Total Compensation',
  'Base Salary (USD)',
  'Total Compensation (USD)',
] as const;

export function employeeCsvRow(e: EmployeeListItem): string {
  return csvRow([
    e.employeeCode,
    e.firstName,
    e.lastName,
    e.email,
    e.jobTitle,
    e.level,
    e.status,
    e.hireDate,
    e.country.name,
    e.department.name,
    e.pay?.currency,
    e.pay?.base,
    e.pay?.total,
    e.pay?.baseUsd,
    e.pay?.totalUsd,
  ]);
}

/**
 * Turns batches of employees into CSV chunks. The BOM makes Excel open the
 * file as UTF-8 (names like "Müller" stay intact).
 */
export async function* employeesToCsv(
  batches: AsyncIterable<EmployeeListItem[]>,
): AsyncGenerator<string> {
  yield UTF8_BOM + csvRow(EMPLOYEE_CSV_HEADER);
  for await (const batch of batches) {
    if (batch.length > 0) yield batch.map(employeeCsvRow).join('');
  }
}
