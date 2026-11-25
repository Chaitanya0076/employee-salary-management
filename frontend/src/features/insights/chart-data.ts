import type { RankedBar } from '@/components/charts/ranked-bar-chart';
import type { HistogramBin } from '@/components/charts/histogram-chart';
import { formatMoney, formatNumber } from '@/lib/format';
import type { CountryBreakdown, DepartmentBreakdown, HistogramBucket } from './api';

const usd = (v: string) => formatMoney(v, 'USD');
const usdCompact = (v: string | number) => formatMoney(v, 'USD', { compact: true });

/** Countries ranked by total pay (USD), with local totals in the tooltip. */
export function countryBars(rows: CountryBreakdown[]): RankedBar[] {
  return [...rows]
    .sort((a, b) => Number(b.totalPayUsd) - Number(a.totalPayUsd))
    .map((r) => ({
      key: r.country.code,
      label: r.country.name,
      value: Number(r.totalPayUsd),
      tipLabel: usdCompact(r.totalPayUsd),
      tooltip: [
        { label: 'Total pay (USD)', value: usd(r.totalPayUsd) },
        ...(r.currency !== 'USD'
          ? [{ label: `Total pay (${r.currency})`, value: formatMoney(r.totalPay, r.currency) }]
          : []),
        { label: 'Headcount', value: formatNumber(r.headcount) },
      ],
    }));
}

export function departmentBars(rows: DepartmentBreakdown[]): RankedBar[] {
  return [...rows]
    .sort((a, b) => Number(b.totalPayUsd) - Number(a.totalPayUsd))
    .map((r) => ({
      key: String(r.department.id),
      label: r.department.name,
      value: Number(r.totalPayUsd),
      tipLabel: usdCompact(r.totalPayUsd),
      tooltip: [
        { label: 'Total pay (USD)', value: usd(r.totalPayUsd) },
        { label: 'Median base (USD)', value: r.base.median ? usd(r.base.median) : '—' },
        { label: 'Headcount', value: formatNumber(r.headcount) },
      ],
    }));
}

/** Each bin is labelled with its whole range ("£50K–£100K"), not just one edge. */
export function histogramBins(buckets: HistogramBucket[], currency: string): HistogramBin[] {
  const compact = (v: string) => formatMoney(v, currency, { compact: true });
  return buckets.map((b) => ({
    label: `${compact(b.from)}–${compact(b.to)}`,
    rangeLabel: `${compact(b.from)} – ${compact(b.to)}`,
    count: b.count,
  }));
}

export const compactUsdTick = (v: number) => usdCompact(v);
