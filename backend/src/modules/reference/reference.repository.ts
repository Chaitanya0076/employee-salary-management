import type { PrismaClient } from '../../shared/db/index.js';
import type { CountryDto, DepartmentDto, FxRateDto } from './reference.types.js';

export interface ReferenceRepository {
  listCountries(): Promise<CountryDto[]>;
  listDepartments(): Promise<DepartmentDto[]>;
  listFxRates(): Promise<FxRateDto[]>;
  findCountry(code: string): Promise<CountryDto | null>;
  findDepartment(id: number): Promise<DepartmentDto | null>;
  findFxRate(currency: string): Promise<FxRateDto | null>;
  updateFxRate(currency: string, rateToUsd: string): Promise<FxRateDto>;
}

const COUNTRY = { code: true, name: true, currency: true } as const;
const DEPARTMENT = { id: true, name: true } as const;

function toFxRateDto(row: {
  currency: string;
  rateToUsd: { toFixed(dp: number): string };
  updatedAt: Date;
}): FxRateDto {
  return {
    currency: row.currency,
    rateToUsd: row.rateToUsd.toFixed(8),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function createReferenceRepository(prisma: PrismaClient): ReferenceRepository {
  return {
    listCountries: () => prisma.country.findMany({ select: COUNTRY, orderBy: { name: 'asc' } }),
    listDepartments: () =>
      prisma.department.findMany({ select: DEPARTMENT, orderBy: { name: 'asc' } }),
    listFxRates: async () =>
      (await prisma.fxRate.findMany({ orderBy: { currency: 'asc' } })).map(toFxRateDto),
    findCountry: (code) => prisma.country.findUnique({ where: { code }, select: COUNTRY }),
    findDepartment: (id) => prisma.department.findUnique({ where: { id }, select: DEPARTMENT }),
    findFxRate: async (currency) => {
      const row = await prisma.fxRate.findUnique({ where: { currency } });
      return row && toFxRateDto(row);
    },
    updateFxRate: async (currency, rateToUsd) =>
      toFxRateDto(await prisma.fxRate.update({ where: { currency }, data: { rateToUsd } })),
  };
}
