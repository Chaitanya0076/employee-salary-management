import { NotFoundError } from '../../shared/errors/index.js';
import type { Clock } from '../../shared/utils/index.js';
import type { CompensationRepository } from './compensation.repository.js';
import { decidePayChange, payChange } from './compensation.rules.js';
import type { CompensationHistory, PayChangeInput, PayChangeResult } from './compensation.types.js';

export interface CompensationService {
  getHistory(employeeId: number): Promise<CompensationHistory>;
  changePay(employeeId: number, input: PayChangeInput): Promise<PayChangeResult>;
}

export interface CompensationServiceDeps {
  compensation: CompensationRepository;
  clock: Clock;
}

const notFound = (id: number) => new NotFoundError(`Employee ${id} not found`);

export function createCompensationService({
  compensation,
  clock,
}: CompensationServiceDeps): CompensationService {
  async function getHistory(employeeId: number): Promise<CompensationHistory> {
    const found = await compensation.findHistory(employeeId);
    if (!found) throw notFound(employeeId);
    return {
      employeeId,
      currency: found.currency,
      current: found.records.find((r) => r.effectiveTo === null) ?? null,
      history: found.records,
    };
  }

  return {
    getHistory,

    async changePay(employeeId, input) {
      const today = clock.today();
      const created = await compensation.changePay(employeeId, (state) =>
        decidePayChange(state, input, today),
      );
      if (!created) throw notFound(employeeId);

      const { history } = await getHistory(employeeId);
      const record = history.find((r) => r.id === created.id);
      const previous = record && history.find((r) => r.effectiveTo === record.effectiveFrom);
      if (!record || !previous)
        throw new Error(`Pay change ${created.id} was not found after commit`);

      return { compensation: record, previous, change: payChange(previous, record) };
    },
  };
}
