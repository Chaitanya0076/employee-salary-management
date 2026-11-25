/**
 * "Nice" histogram buckets: steps of 1, 2, 2.5 or 5 x 10^k, starting at a
 * multiple of the step, so edges read like 50,000 / 100,000 / 150,000.
 */
export interface BucketPlan {
  start: number;
  step: number;
  count: number;
}

const NICE_FACTORS = [1, 2, 2.5, 5, 10] as const;

/** Smallest nice number >= value (minimum 1: amounts are whole currency units or more). */
export function niceStep(value: number): number {
  if (!(value > 1)) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const factor = NICE_FACTORS.find((f) => f * magnitude >= value) ?? 10;
  return factor * magnitude;
}

/** Next nice number strictly greater than a nice step. */
function nextNiceStep(step: number): number {
  return niceStep(step * 1.000001);
}

/**
 * Plans at most `requested` buckets covering [min, max]. The last bucket
 * includes its upper edge, so a value exactly on it is still counted.
 */
export function planBuckets(min: number, max: number, requested: number): BucketPlan {
  if (max < min) throw new RangeError('max must be >= min');
  let step = min === max ? niceStep(Math.max(max, 1) / 10) : niceStep((max - min) / requested);
  for (;;) {
    const start = Math.floor(min / step) * step;
    const count = Math.max(1, Math.ceil((max - start) / step));
    if (count <= requested) return { start, step, count };
    step = nextNiceStep(step);
  }
}
