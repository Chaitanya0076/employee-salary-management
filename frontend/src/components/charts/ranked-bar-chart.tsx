import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ACCENT, AXIS_LINE, AXIS_TICK, GRID_STROKE } from './axis';
import { ChartTooltipContent, type TooltipRow } from './chart-tooltip';

export interface RankedBar {
  key: string;
  label: string;
  value: number;
  /** Short label printed at the bar tip (e.g. "$381.8M"). */
  tipLabel: string;
  /** Rows shown in the tooltip, with full values. */
  tooltip: TooltipRow[];
}

interface Props {
  data: RankedBar[];
  formatTick: (value: number) => string;
  onSelect?: (bar: RankedBar) => void;
  categoryWidth?: number;
}

const ROW_HEIGHT = 36;

/**
 * Horizontal bars ranked largest first, one hue (magnitude comparison):
 * <= 24px thick, rounded at the data end and square at the baseline, value at the tip.
 */
export function RankedBarChart({ data, formatTick, onSelect, categoryWidth = 120 }: Props) {
  const height = data.length * ROW_HEIGHT + 32;
  return (
    <ResponsiveContainer width="100%" height={height} initialDimension={{ width: 600, height }}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 64, bottom: 0, left: 0 }}>
        <CartesianGrid horizontal={false} stroke={GRID_STROKE} />
        <XAxis
          type="number"
          tickFormatter={formatTick}
          tick={AXIS_TICK}
          axisLine={AXIS_LINE}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="label"
          width={categoryWidth}
          tick={{ ...AXIS_TICK, fill: 'var(--foreground)' }}
          axisLine={AXIS_LINE}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: 'var(--viz-hover)' }}
          content={({ active, payload }) => {
            const bar = payload?.[0]?.payload as RankedBar | undefined;
            return active && bar ? (
              <ChartTooltipContent title={bar.label} rows={bar.tooltip} />
            ) : null;
          }}
        />
        <Bar
          dataKey="value"
          fill={ACCENT}
          barSize={20}
          radius={[0, 4, 4, 0]}
          isAnimationActive={false}
          cursor={onSelect ? 'pointer' : undefined}
          onClick={onSelect ? (entry) => onSelect(entry.payload as RankedBar) : undefined}
        >
          <LabelList
            dataKey="tipLabel"
            position="right"
            fill="var(--muted-foreground)"
            fontSize={12}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
