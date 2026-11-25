/**
 * Compensation rules (docs/data-model.md R1-R8). Pure functions: no database,
 * no clock; callers pass "today" in.
 */
import { Prisma } from '../../generated/prisma/client.js';
import { ConflictError, ValidationError } from '../../shared/errors/index.js';
import type {
  AmountChange,
  CompensationComponentDto,
  CompensationRecord,
  LockedPayState,
  NewCompensation,
  PayChangeInput,
} from './compensation.types.js';

export const COMPONENT_TYPES = ['BASE', 'BONUS', 'ALLOWANCE'] as const;
export type ComponentTypeName = (typeof COMPONENT_TYPES)[number];

export interface ComponentIssue {
  /** Path relative to the components array, e.g. [2, 'type']. */
  path: (string | number)[];
  message: string;
}

/** R1: exactly one BASE, and no component type more than once. */
export function componentIssues(
  components: readonly { type: ComponentTypeName }[],
): ComponentIssue[] {
  const issues: ComponentIssue[] = [];
  if (!components.some((c) => c.type === 'BASE')) {
    issues.push({ path: [], message: 'A BASE component is required' });
  }
  const seen = new Set<ComponentTypeName>();
  components.forEach((c, i) => {
    if (seen.has(c.type))
      issues.push({ path: [i, 'type'], message: `Duplicate ${c.type} component` });
    seen.add(c.type);
  });
  return issues;
}

function sameComponents(
  a: readonly CompensationComponentDto[],
  b: readonly CompensationComponentDto[],
): boolean {
  const normalise = (list: readonly CompensationComponentDto[]) =>
    list
      .map((c) => `${c.type}=${new Prisma.Decimal(c.amount).toFixed(2)}`)
      .sort()
      .join('|');
  return normalise(a) === normalise(b);
}

/**
 * Decides the new compensation record for a pay change, given the state read
 * under lock. Throws when the change is not allowed.
 */
export function decidePayChange(
  state: LockedPayState,
  input: PayChangeInput,
  today: string,
): NewCompensation {
  if (state.employee.status !== 'ACTIVE') {
    throw new ConflictError('Pay cannot be changed for an inactive employee');
  }
  const { current } = state;
  if (!current) {
    // R5/R7 guarantee an open record, so this only happens when a concurrent
    // change closed it while this request waited for the lock.
    throw new ConflictError('Pay was changed by another request; reload and try again');
  }

  const dateIssues: string[] = [];
  // R4: periods never overlap, so a change starts strictly after the current record.
  if (input.effectiveFrom <= current.effectiveFrom) {
    dateIssues.push(`Must be after the current pay's start date (${current.effectiveFrom})`);
  }
  // R6: no future-dated changes in v1.
  if (input.effectiveFrom > today) dateIssues.push('Cannot be in the future');
  if (dateIssues.length > 0) {
    throw new ValidationError(
      'Request validation failed',
      dateIssues.map((message) => ({ path: 'body.effectiveFrom', message })),
    );
  }

  if (sameComponents(input.components, current.components)) {
    throw new ValidationError('Request validation failed', [
      { path: 'body.components', message: 'New pay is identical to the current pay' },
    ]);
  }

  return {
    // R3: always the employee's country currency.
    currency: state.employee.currency,
    effectiveFrom: input.effectiveFrom,
    reason: input.reason ?? null,
    components: input.components,
  };
}

export function amountChange(previous: string, next: string): AmountChange {
  const before = new Prisma.Decimal(previous);
  const delta = new Prisma.Decimal(next).minus(before);
  return {
    amount: delta.toFixed(2),
    percent: before.isZero()
      ? null
      : delta.div(before).times(100).toFixed(2, Prisma.Decimal.ROUND_HALF_UP),
  };
}

export function payChange(previous: CompensationRecord, next: CompensationRecord) {
  return {
    base: amountChange(previous.base, next.base),
    total: amountChange(previous.total, next.total),
  };
}
