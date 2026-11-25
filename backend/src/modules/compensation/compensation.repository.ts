import type { PrismaClient } from '../../shared/db/index.js';
import { fromIsoDate, toIsoDate, toMoneyString } from '../../shared/utils/index.js';
import { toCompensationRecord } from './compensation.mapper.js';
import type { ComponentTypeName } from './compensation.rules.js';
import type { CompensationRecord, LockedPayState, NewCompensation } from './compensation.types.js';

export interface CompensationRepository {
  /** All records newest first, or null if the employee does not exist. */
  findHistory(
    employeeId: number,
  ): Promise<{ currency: string; records: CompensationRecord[] } | null>;
  /**
   * In one transaction: locks the employee's current record, asks `decide` for
   * the new record (it may throw to abort), closes the current record and
   * inserts the new one. Returns null if the employee does not exist.
   */
  changePay(
    employeeId: number,
    decide: (state: LockedPayState) => NewCompensation,
  ): Promise<{ id: number } | null>;
}

const COMPONENT_ORDER = { components: { orderBy: { type: 'asc' } } } as const;

export function createCompensationRepository(prisma: PrismaClient): CompensationRepository {
  return {
    async findHistory(employeeId) {
      const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        select: {
          country: { select: { currency: true, fxRate: { select: { rateToUsd: true } } } },
          compensations: { orderBy: { effectiveFrom: 'desc' }, include: COMPONENT_ORDER },
        },
      });
      if (!employee) return null;
      const rate = employee.country.fxRate.rateToUsd;
      return {
        currency: employee.country.currency,
        records: employee.compensations.map((row) => toCompensationRecord(row, rate)),
      };
    },

    changePay(employeeId, decide) {
      return prisma.$transaction(async (tx) => {
        const employee = await tx.employee.findUnique({
          where: { id: employeeId },
          select: { id: true, status: true, country: { select: { currency: true } } },
        });
        if (!employee) return null;

        // Row lock on the open record: a concurrent change for the same employee
        // waits here, then finds no open record (this one closed it) and is rejected.
        const [locked] = await tx.$queryRaw<{ id: number; effective_from: Date }[]>`
          SELECT id, effective_from FROM compensations
          WHERE employee_id = ${employeeId} AND effective_to IS NULL
          FOR UPDATE`;
        const components = locked
          ? await tx.compensationComponent.findMany({
              where: { compensationId: locked.id },
              select: { type: true, amount: true },
            })
          : [];

        const next = decide({
          employee: {
            id: employee.id,
            status: employee.status,
            currency: employee.country.currency,
          },
          current: locked
            ? {
                id: locked.id,
                effectiveFrom: toIsoDate(locked.effective_from),
                components: components.map((c) => ({
                  type: c.type as ComponentTypeName,
                  amount: toMoneyString(c.amount),
                })),
              }
            : null,
        });
        if (!locked)
          throw new Error('decide() must reject a change when there is no current record');

        const effectiveFrom = fromIsoDate(next.effectiveFrom);
        await tx.compensation.update({
          where: { id: locked.id },
          data: { effectiveTo: effectiveFrom },
        });
        const created = await tx.compensation.create({
          data: {
            employeeId,
            currency: next.currency,
            effectiveFrom,
            reason: next.reason,
            components: { create: next.components },
          },
          select: { id: true },
        });
        return { id: created.id };
      });
    },
  };
}
