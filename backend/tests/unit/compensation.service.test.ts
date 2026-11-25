import { describe, expect, it, vi } from 'vitest';
import {
  createCompensationService,
  type CompensationRecord,
  type CompensationRepository,
  type LockedPayState,
} from '../../src/modules/compensation/index.js';
import { NotFoundError, ValidationError } from '../../src/shared/errors/index.js';

const TODAY = '2026-06-15';

function record(overrides: Partial<CompensationRecord>): CompensationRecord {
  return {
    id: 1,
    currency: 'GBP',
    effectiveFrom: '2025-04-01',
    effectiveTo: null,
    reason: null,
    components: [{ type: 'BASE', amount: '50000.00' }],
    base: '50000.00',
    total: '50000.00',
    baseUsd: '63500.00',
    totalUsd: '63500.00',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const lockedState: LockedPayState = {
  employee: { id: 2, status: 'ACTIVE', currency: 'GBP' },
  current: {
    id: 1,
    effectiveFrom: '2025-04-01',
    components: [{ type: 'BASE', amount: '50000.00' }],
  },
};

function setup(repo: Partial<CompensationRepository> = {}) {
  const compensation: CompensationRepository = {
    findHistory: vi.fn(async () => ({ currency: 'GBP', records: [record({})] })),
    // Mimics the real repository: calls decide with the locked state.
    changePay: vi.fn(async (_id, decide) => {
      decide(lockedState);
      return { id: 2 };
    }),
    ...repo,
  };
  return {
    service: createCompensationService({ compensation, clock: { today: () => TODAY } }),
    compensation,
  };
}

describe('CompensationService.getHistory', () => {
  it('returns the current record and the full history', async () => {
    const older = record({ id: 1, effectiveTo: '2026-04-01' });
    const current = record({ id: 2, effectiveFrom: '2026-04-01' });
    const { service } = setup({
      findHistory: vi.fn(async () => ({ currency: 'GBP', records: [current, older] })),
    });

    await expect(service.getHistory(2)).resolves.toEqual({
      employeeId: 2,
      currency: 'GBP',
      current,
      history: [current, older],
    });
  });

  it('throws NotFoundError for an unknown employee', async () => {
    const { service } = setup({ findHistory: vi.fn(async () => null) });

    await expect(service.getHistory(9)).rejects.toThrow(new NotFoundError('Employee 9 not found'));
  });
});

describe('CompensationService.changePay', () => {
  const input = {
    effectiveFrom: '2026-04-01',
    components: [{ type: 'BASE' as const, amount: '55000' }],
  };

  it('returns the new record, the previous one and the change between them', async () => {
    const previous = record({ id: 1, effectiveTo: '2026-04-01' });
    const created = record({
      id: 2,
      effectiveFrom: '2026-04-01',
      base: '55000.00',
      total: '55000.00',
    });
    const { service } = setup({
      findHistory: vi.fn(async () => ({ currency: 'GBP', records: [created, previous] })),
    });

    await expect(service.changePay(2, input)).resolves.toEqual({
      compensation: created,
      previous,
      change: {
        base: { amount: '5000.00', percent: '10.00' },
        total: { amount: '5000.00', percent: '10.00' },
      },
    });
  });

  it('applies the rules with the injected clock inside the repository transaction', async () => {
    const { service } = setup();

    await expect(
      service.changePay(2, { ...input, effectiveFrom: '2026-06-16' }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws NotFoundError for an unknown employee', async () => {
    const { service } = setup({ changePay: vi.fn(async () => null) });

    await expect(service.changePay(9, input)).rejects.toBeInstanceOf(NotFoundError);
  });
});
