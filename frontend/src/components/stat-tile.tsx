import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface Props {
  label: string;
  value: string | undefined;
  hint?: string;
  /** Makes the whole tile a link (e.g. to a filtered view). */
  to?: string;
  loading?: boolean;
}

/** KPI tile: sentence-case label, semibold value (proportional figures), optional hint. */
export function StatTile({ label, value, hint, to, loading }: Props) {
  const content = (
    <>
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{label}</span>
        {to && (
          <ArrowUpRight
            className="size-4 opacity-0 transition-opacity group-hover:opacity-100"
            aria-hidden="true"
          />
        )}
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-8 w-28" />
      ) : (
        <div className="mt-1 text-2xl font-semibold tracking-tight">{value ?? '—'}</div>
      )}
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </>
  );

  return (
    <Card className={cn('gap-0 p-4', to && 'group transition-colors hover:bg-accent/50')}>
      {to ? (
        <Link
          to={to}
          className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {content}
        </Link>
      ) : (
        content
      )}
    </Card>
  );
}
