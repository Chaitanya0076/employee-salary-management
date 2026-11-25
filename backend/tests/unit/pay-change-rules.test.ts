import { describe, expect, it } from 'vitest';
import {
  amountChange,
  decidePayChange,
  type LockedPayState,
  type PayChangeInput,
} from '../../src/modules/compensation/index.js';
import { ConflictError, ValidationError } from '../../src/shared/errors/index.js';

const TODAY = '2026-06-15';

const state: LockedPayState = {
  employee: { id: 2, status: 'ACTIVE', currency: 'GBP' },
  current: {
    id: 10,
    effectiveFrom: '2025-04-01',
    components: [
      { type: 'BASE', amount: '50000.00' },
      { type: 'ALLOWANCE', amount: '2000.00' },
    ],
  },
};

const raise: PayChangeInput = {
  effectiveFrom: '2026-04-01',
  components: [
    { type: 'BASE', amount: '55000' },
    { type: 'ALLOWANCE', amount: '2000' },
  ],
  reason: 'Annual review',
};

function errorFrom(fn: () => unknown): unknown {
  try {
    fn();
  } catch (err) {
    return err;
  }
  throw new Error('expected an error');
}

const paths = (err: unknown) => (err as ValidationError).details?.map((d) => d.path);

describe('decidePayChange', () => {
  it('returns the new record in the employee currency', () => {
    expect(decidePayChange(state, raise, TODAY)).toEqual({
      currency: 'GBP',
      effectiveFrom: '2026-04-01',
      reason: 'Annual review',
      components: raise.components,
    });
  });

  it('stores a missing reason as null', () => {
    expect(decidePayChange(state, { ...raise, reason: undefined }, TODAY).reason).toBeNull();
  });

  it('allows a change effective today, and pay cuts', () => {
    const cut = {
      ...raise,
      effectiveFrom: TODAY,
      components: [{ type: 'BASE' as const, amount: '45000' }],
    };
    expect(decidePayChange(state, cut, TODAY).effectiveFrom).toBe(TODAY);
  });

  it.each([
    ['on the same day as the current record', '2025-04-01'],
    ['before the current record', '2024-01-01'],
  ])('rejects a change starting %s', (_label, effectiveFrom) => {
    const err = errorFrom(() => decidePayChange(state, { ...raise, effectiveFrom }, TODAY));

    expect(err).toBeInstanceOf(ValidationError);
    expect((err as ValidationError).details).toEqual([
      {
        path: 'body.effectiveFrom',
        message: "Must be after the current pay's start date (2025-04-01)",
      },
    ]);
  });

  it('rejects a future-dated change', () => {
    const err = errorFrom(() =>
      decidePayChange(state, { ...raise, effectiveFrom: '2026-06-16' }, TODAY),
    );

    expect(err).toBeInstanceOf(ValidationError);
    expect(paths(err)).toEqual(['body.effectiveFrom']);
  });

  it('rejects pay identical to the current pay, regardless of order and number format', () => {
    const same = {
      ...raise,
      components: [
        { type: 'ALLOWANCE' as const, amount: '2000' },
        { type: 'BASE' as const, amount: '50000.0' },
      ],
    };

    expect(paths(errorFrom(() => decidePayChange(state, same, TODAY)))).toEqual([
      'body.components',
    ]);
  });

  it('rejects a change for an inactive employee', () => {
    const inactive = { ...state, employee: { ...state.employee, status: 'INACTIVE' as const } };

    expect(errorFrom(() => decidePayChange(inactive, raise, TODAY))).toBeInstanceOf(ConflictError);
  });

  it('rejects with 409 when there is no open record (closed by a concurrent change)', () => {
    const err = errorFrom(() => decidePayChange({ ...state, current: null }, raise, TODAY));

    expect(err).toBeInstanceOf(ConflictError);
    expect((err as Error).message).toMatch(/another request/);
  });
});

describe('amountChange', () => {
  it.each([
    ['50000.00', '55000.00', { amount: '5000.00', percent: '10.00' }],
    ['52000.00', '57000.00', { amount: '5000.00', percent: '9.62' }],
    ['50000.00', '45000.00', { amount: '-5000.00', percent: '-10.00' }],
    ['30000.00', '30000.00', { amount: '0.00', percent: '0.00' }],
    ['0.00', '100.00', { amount: '100.00', percent: null }],
  ])('from %s to %s', (before, after, expected) => {
    expect(amountChange(before, after)).toEqual(expected);
  });
});
