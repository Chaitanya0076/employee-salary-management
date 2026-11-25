import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { ApiError } from './api-client';

/**
 * Puts server-side validation messages onto the matching form fields.
 * `rename` maps server field paths to form paths (e.g. "compensation.components"
 * -> "components"). Returns the messages that matched no field, plus the
 * error message itself when nothing matched, for a form-level alert.
 */
export function applyServerErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly string[],
  rename: Record<string, string> = {},
): string | null {
  if (!(error instanceof ApiError)) return 'Something went wrong. Please try again.';

  const unmatched: string[] = [];
  let matched = 0;
  for (const [serverPath, message] of Object.entries(error.fieldErrors())) {
    const prefix = Object.keys(rename).find(
      (p) => serverPath === p || serverPath.startsWith(`${p}.`),
    );
    const path = prefix ? rename[prefix] + serverPath.slice(prefix.length) : serverPath;
    const root = path.split('.')[0]!;
    if (fields.includes(root)) {
      setError(path as Path<T>, { type: 'server', message });
      matched++;
    } else {
      unmatched.push(message);
    }
  }
  if (unmatched.length > 0) return unmatched.join(' ');
  return matched > 0 ? null : error.message;
}
