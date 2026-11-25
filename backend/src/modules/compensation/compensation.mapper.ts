import { Prisma } from '../../generated/prisma/client.js';
import { convertAmount, sumAmounts, toIsoDate, toMoneyString } from '../../shared/utils/index.js';
import type { ComponentTypeName } from './compensation.rules.js';
import type { CompensationRecord } from './compensation.types.js';

export interface CompensationRow {
  id: number;
  currency: string;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  reason: string | null;
  createdAt: Date;
  components: { type: string; amount: Prisma.Decimal }[];
}

/** Builds the API shape of a pay record, with totals and USD equivalents. */
export function toCompensationRecord(
  row: CompensationRow,
  rateToUsd: Prisma.Decimal,
): CompensationRecord {
  const base = row.components.find((c) => c.type === 'BASE')?.amount ?? new Prisma.Decimal(0);
  const total = sumAmounts(row.components.map((c) => c.amount));
  return {
    id: row.id,
    currency: row.currency,
    effectiveFrom: toIsoDate(row.effectiveFrom),
    effectiveTo: row.effectiveTo ? toIsoDate(row.effectiveTo) : null,
    reason: row.reason,
    components: row.components.map((c) => ({
      type: c.type as ComponentTypeName,
      amount: toMoneyString(c.amount),
    })),
    base: toMoneyString(base),
    total: toMoneyString(total),
    baseUsd: toMoneyString(convertAmount(base, rateToUsd)),
    totalUsd: toMoneyString(convertAmount(total, rateToUsd)),
    createdAt: row.createdAt.toISOString(),
  };
}
