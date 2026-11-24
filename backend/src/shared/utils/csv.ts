/**
 * RFC 4180 CSV with protection against spreadsheet formula injection
 * (OWASP "CSV injection"): text cells starting with = + - @ tab or CR are
 * prefixed with a single quote so Excel/Sheets treat them as text.
 */
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;
const NEEDS_QUOTING = /[",\r\n]/;

export const UTF8_BOM = '﻿';

export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (typeof value === 'string' && FORMULA_TRIGGER.test(text)) text = `'${text}`;
  return NEEDS_QUOTING.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function csvRow(values: readonly (string | number | null | undefined)[]): string {
  return `${values.map(csvCell).join(',')}\r\n`;
}
