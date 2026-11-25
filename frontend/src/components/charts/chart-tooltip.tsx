import type { ReactNode } from 'react';

export interface TooltipRow {
  label: string;
  value: string;
}

/** Tooltip body: values lead (strong), labels follow (secondary). Text uses text tokens. */
export function ChartTooltipContent({ title, rows }: { title: ReactNode; rows: TooltipRow[] }) {
  return (
    <div className="min-w-40 rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="mb-1 font-medium text-popover-foreground">{title}</div>
      <div className="grid gap-0.5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-4">
            <span className="text-muted-foreground">{row.label}</span>
            <span className="font-semibold tabular-nums text-popover-foreground">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
