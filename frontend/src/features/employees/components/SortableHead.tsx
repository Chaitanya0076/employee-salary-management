import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { TableHead } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { SortDirection, SortField } from '../list-params';

interface Props {
  field: SortField;
  label: string;
  sort: SortField;
  direction: SortDirection;
  onSort: (field: SortField, direction: SortDirection) => void;
  className?: string;
  /** First click sorts descending (useful for pay: highest first). */
  descFirst?: boolean;
}

/** Column header that sorts on click; exposes the state via aria-sort. */
export function SortableHead({
  field,
  label,
  sort,
  direction,
  onSort,
  className,
  descFirst,
}: Props) {
  const active = sort === field;
  const next: SortDirection = active
    ? direction === 'asc'
      ? 'desc'
      : 'asc'
    : descFirst
      ? 'desc'
      : 'asc';
  const Icon = !active ? ArrowUpDown : direction === 'asc' ? ArrowUp : ArrowDown;

  return (
    <TableHead
      aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={className}
    >
      <button
        type="button"
        onClick={() => onSort(field, next)}
        className={cn(
          '-mx-2 inline-flex items-center gap-1 rounded px-2 py-1 font-medium hover:bg-accent',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          active ? 'text-foreground' : 'text-muted-foreground',
        )}
      >
        {label}
        <Icon className="size-3.5" aria-hidden="true" />
      </button>
    </TableHead>
  );
}
