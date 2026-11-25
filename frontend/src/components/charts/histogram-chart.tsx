import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatNumber } from '@/lib/format';
import { ACCENT, AXIS_LINE, AXIS_TICK, GRID_STROKE } from './axis';
import { ChartTooltipContent } from './chart-tooltip';

export interface HistogramBin {
  label: string;
  rangeLabel: string;
  count: number;
}

const HEIGHT = 260;

/**
 * Distribution columns: one hue, rounded tops, square at the baseline.
 * Unlike category bars (capped at 24px), histogram bins are adjacent ranges of
 * one continuous scale, so they fill their band and are separated only by the
 * 2px surface gap: thin isolated bars would read as unrelated categories.
 */
export function HistogramChart({ data }: { data: HistogramBin[] }) {
  return (
    <ResponsiveContainer
      width="100%"
      height={HEIGHT}
      initialDimension={{ width: 600, height: HEIGHT }}
    >
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap={2}>
        <CartesianGrid vertical={false} stroke={GRID_STROKE} />
        <XAxis
          dataKey="label"
          tick={AXIS_TICK}
          axisLine={AXIS_LINE}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tickFormatter={(v: number) => formatNumber(v)}
          tick={AXIS_TICK}
          axisLine={false}
          tickLine={false}
          width={48}
        />
        <Tooltip
          cursor={{ fill: 'var(--viz-hover)' }}
          content={({ active, payload }) => {
            const bin = payload?.[0]?.payload as HistogramBin | undefined;
            return active && bin ? (
              <ChartTooltipContent
                title={bin.rangeLabel}
                rows={[{ label: 'Employees', value: formatNumber(bin.count) }]}
              />
            ) : null;
          }}
        />
        <Bar dataKey="count" fill={ACCENT} radius={[4, 4, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}
