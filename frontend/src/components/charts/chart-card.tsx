import { BarChart3, RotateCw } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface QueryState {
  isPending: boolean;
  isError: boolean;
  isFetching?: boolean;
  error?: Error | null;
  refetch: () => unknown;
}

interface Props {
  title: string;
  description?: string;
  query: QueryState;
  isEmpty?: boolean;
  emptyMessage?: string;
  /** Header controls (e.g. bucket count, "view all" link). */
  action?: ReactNode;
  /** Same data as the chart, as a table: shown behind "View as table" (and read by screen readers). */
  table?: ReactNode;
  className?: string;
  children?: ReactNode;
}

/**
 * Card wrapping one chart or table: title/description, loading, empty and error
 * states, and an accessible table view of the plotted data. While refetching,
 * the previous render stays at reduced opacity (no flash, no layout jump).
 */
export function ChartCard({
  title,
  description,
  query,
  isEmpty,
  emptyMessage = 'No data for this selection.',
  action,
  table,
  className,
  children,
}: Props) {
  const titleId = useId();
  const descriptionId = useId();

  let body: ReactNode;
  if (query.isPending) {
    body = <Skeleton className="h-56 w-full" aria-label={`Loading ${title}`} />;
  } else if (query.isError) {
    body = (
      <div
        role="alert"
        className="flex h-56 flex-col items-center justify-center gap-2 text-center text-sm"
      >
        <p className="font-medium">Couldn't load this chart</p>
        <p className="text-muted-foreground">{query.error?.message}</p>
        <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
          <RotateCw aria-hidden="true" /> Try again
        </Button>
      </div>
    );
  } else if (isEmpty) {
    body = (
      <div className="flex h-56 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
        <BarChart3 className="size-6" aria-hidden="true" />
        {emptyMessage}
      </div>
    );
  } else {
    body = (
      <>
        <figure
          aria-labelledby={titleId}
          aria-describedby={description ? descriptionId : undefined}
          className={cn('m-0 transition-opacity', query.isFetching && 'opacity-60')}
        >
          {children}
        </figure>
        {table && (
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
              View as table
            </summary>
            <div className="mt-2 overflow-x-auto">{table}</div>
          </details>
        )}
      </>
    );
  }

  return (
    <Card className={cn('gap-4', className)}>
      <CardHeader>
        {/* A real heading, so screen-reader users can jump between charts. */}
        <CardTitle>
          <h2 id={titleId} className="text-base">
            {title}
          </h2>
        </CardTitle>
        {description && <CardDescription id={descriptionId}>{description}</CardDescription>}
        {action && <CardAction>{action}</CardAction>}
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  );
}
