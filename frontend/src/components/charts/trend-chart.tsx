import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatNumber } from '@/lib/format';
import { ACCENT, AXIS_LINE, AXIS_TICK, GRID_STROKE } from './axis';
import { ChartTooltipContent } from './chart-tooltip';

export interface TrendPoint {
  year: number;
  hires: number;
  cumulative: number;
}

const HEIGHT = 240;

/** Single-series trend: a 2px line over a ~10% wash, crosshair tooltip snapping to the year. */
export function TrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <ResponsiveContainer
      width="100%"
      height={HEIGHT}
      initialDimension={{ width: 600, height: HEIGHT }}
    >
      <AreaChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke={GRID_STROKE} />
        <XAxis dataKey="year" tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} />
        <YAxis
          tickFormatter={(v: number) => formatNumber(v)}
          tick={AXIS_TICK}
          axisLine={false}
          tickLine={false}
          width={56}
        />
        <Tooltip
          cursor={{ stroke: 'var(--viz-axis)', strokeWidth: 1 }}
          content={({ active, payload }) => {
            const point = payload?.[0]?.payload as TrendPoint | undefined;
            return active && point ? (
              <ChartTooltipContent
                title={point.year}
                rows={[
                  { label: 'Headcount', value: formatNumber(point.cumulative) },
                  { label: 'Hired that year', value: formatNumber(point.hires) },
                ]}
              />
            ) : null;
          }}
        />
        <Area
          type="monotone"
          dataKey="cumulative"
          stroke={ACCENT}
          strokeWidth={2}
          fill="var(--viz-accent-wash)"
          fillOpacity={1}
          dot={false}
          activeDot={{ r: 4, fill: ACCENT, stroke: 'var(--viz-surface)', strokeWidth: 2 }}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
