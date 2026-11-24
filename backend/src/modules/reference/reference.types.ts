export interface CountryDto {
  code: string;
  name: string;
  currency: string;
}

export interface DepartmentDto {
  id: number;
  name: string;
}

export interface FxRateDto {
  currency: string;
  /** Exact decimal string, e.g. "1.27000000". */
  rateToUsd: string;
  updatedAt: string;
}
