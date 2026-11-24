import { describe, expect, it, vi } from 'vitest';
import {
  createReferenceService,
  type ReferenceRepository,
} from '../../src/modules/reference/index.js';
import { NotFoundError, ValidationError } from '../../src/shared/errors/index.js';

const gbp = { currency: 'GBP', rateToUsd: '1.27000000', updatedAt: '2026-01-01T00:00:00.000Z' };

function setup() {
  const repo = {
    findFxRate: vi.fn(async (currency: string) => (currency === 'GBP' ? gbp : null)),
    updateFxRate: vi.fn(async (currency: string, rateToUsd: string) => ({
      ...gbp,
      currency,
      rateToUsd,
    })),
  } as unknown as ReferenceRepository;
  return { service: createReferenceService(repo), repo };
}

describe('ReferenceService.updateFxRate', () => {
  it('updates an existing rate', async () => {
    const { service, repo } = setup();

    await expect(service.updateFxRate('GBP', '1.3')).resolves.toMatchObject({ rateToUsd: '1.3' });
    expect(repo.updateFxRate).toHaveBeenCalledWith('GBP', '1.3');
  });

  it('refuses to change the USD reporting currency', async () => {
    const { service, repo } = setup();

    await expect(service.updateFxRate('USD', '2')).rejects.toBeInstanceOf(ValidationError);
    expect(repo.updateFxRate).not.toHaveBeenCalled();
  });

  it('returns NotFoundError for an unknown currency', async () => {
    const { service } = setup();

    await expect(service.updateFxRate('JPY', '0.0067')).rejects.toBeInstanceOf(NotFoundError);
  });
});
