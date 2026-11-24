/** Dates without time are exchanged as ISO strings (yyyy-mm-dd) and stored as UTC midnight. */
export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function fromIsoDate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

/** Injected wherever "today" matters, so business rules are testable. */
export interface Clock {
  today(): string;
}

export const systemClock: Clock = { today: () => toIsoDate(new Date()) };
