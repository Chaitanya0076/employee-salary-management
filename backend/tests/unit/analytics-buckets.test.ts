import { describe, expect, it } from 'vitest';
import { niceStep, planBuckets, toHeadcountTrend } from '../../src/modules/analytics/index.js';

describe('niceStep', () => {
  it.each([
    [0, 1],
    [0.4, 1],
    [1, 1],
    [1.2, 2],
    [2.2, 2.5],
    [3, 5],
    [7, 10],
    [45_500, 50_000],
    [120_000, 200_000],
    [230_000, 250_000],
  ])('rounds %d up to %d', (value, expected) => {
    expect(niceStep(value)).toBe(expected);
  });
});

describe('planBuckets', () => {
  const edges = ({ start, step, count }: { start: number; step: number; count: number }) =>
    Array.from({ length: count + 1 }, (_, i) => start + step * i);

  it('uses readable edges starting at a multiple of the step', () => {
    expect(planBuckets(18_000, 200_000, 4)).toEqual({ start: 0, step: 50_000, count: 4 });
  });

  it('never returns more buckets than requested, and always covers min and max', () => {
    for (const [min, max, requested] of [
      [26_500, 181_500, 10],
      [481_700, 3_910_500, 8],
      [5_780.4, 351_200, 7],
      [1, 2, 2],
      [99, 101, 3],
    ] as const) {
      const plan = planBuckets(min, max, requested);
      expect(plan.count).toBeLessThanOrEqual(requested);
      expect(plan.start).toBeLessThanOrEqual(min);
      expect(plan.start + plan.step * plan.count).toBeGreaterThanOrEqual(max);
      expect(plan.start % plan.step).toBe(0);
    }
  });

  it('puts a maximum that lands exactly on an edge into the last bucket instead of adding one', () => {
    const plan = planBuckets(0, 200_000, 4);
    expect(edges(plan)).toEqual([0, 50_000, 100_000, 150_000, 200_000]);
  });

  it('makes a single readable bucket around a lone value', () => {
    // Step is a tenth of the value rounded up to a nice number; the edge snaps to a multiple of it.
    expect(planBuckets(1_500_000, 1_500_000, 10)).toEqual({
      start: 1_400_000,
      step: 200_000,
      count: 1,
    });
    expect(planBuckets(200_000, 200_000, 10)).toEqual({ start: 200_000, step: 20_000, count: 1 });
  });

  it('rejects an inverted range', () => {
    expect(() => planBuckets(10, 5, 3)).toThrow(RangeError);
  });
});

describe('toHeadcountTrend', () => {
  it('fills years without hires and accumulates', () => {
    expect(
      toHeadcountTrend([
        { year: 2018, hires: 1 },
        { year: 2020, hires: 2 },
        { year: 2021, hires: 1 },
      ]),
    ).toEqual([
      { year: 2018, hires: 1, cumulative: 1 },
      { year: 2019, hires: 0, cumulative: 1 },
      { year: 2020, hires: 2, cumulative: 3 },
      { year: 2021, hires: 1, cumulative: 4 },
    ]);
  });

  it('returns an empty trend for no hires', () => {
    expect(toHeadcountTrend([])).toEqual([]);
  });
});
