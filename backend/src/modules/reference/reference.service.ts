import { NotFoundError, ValidationError } from '../../shared/errors/index.js';
import type { ReferenceRepository } from './reference.repository.js';
import type { CountryDto, DepartmentDto, FxRateDto } from './reference.types.js';

/** All reports are expressed in USD, so its rate is fixed at 1. */
export const REPORTING_CURRENCY = 'USD';

export interface ReferenceService {
  listCountries(): Promise<CountryDto[]>;
  listDepartments(): Promise<DepartmentDto[]>;
  listFxRates(): Promise<FxRateDto[]>;
  updateFxRate(currency: string, rateToUsd: string): Promise<FxRateDto>;
}

export function createReferenceService(repo: ReferenceRepository): ReferenceService {
  return {
    listCountries: () => repo.listCountries(),
    listDepartments: () => repo.listDepartments(),
    listFxRates: () => repo.listFxRates(),

    async updateFxRate(currency, rateToUsd) {
      if (currency === REPORTING_CURRENCY) {
        throw new ValidationError('The reporting currency rate cannot be changed', [
          {
            path: 'params.currency',
            message: `${REPORTING_CURRENCY} is the reporting currency; its rate is always 1`,
          },
        ]);
      }
      if (!(await repo.findFxRate(currency))) {
        throw new NotFoundError(`No FX rate exists for currency ${currency}`);
      }
      return repo.updateFxRate(currency, rateToUsd);
    },
  };
}
