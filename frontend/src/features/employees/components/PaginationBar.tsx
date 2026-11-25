import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { formatNumber } from '@/lib/format';
import { PAGE_SIZES } from '../list-params';
import type { PageMeta } from '../types';

interface Props {
  meta: PageMeta;
  onPage: (page: number) => void;
  onPageSize: (pageSize: number) => void;
}

export function PaginationBar({ meta, onPage, onPageSize }: Props) {
  const { page, pageSize, total, totalPages } = meta;
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-between gap-3 text-sm"
    >
      <p className="text-muted-foreground" aria-live="polite">
        {total === 0
          ? 'No employees'
          : `Showing ${formatNumber(from)}–${formatNumber(to)} of ${formatNumber(total)}`}
      </p>
      <div className="flex items-center gap-2">
        <Label htmlFor="page-size" className="text-muted-foreground">
          Rows per page
        </Label>
        <NativeSelect
          id="page-size"
          value={pageSize}
          onChange={(e) => onPageSize(Number(e.target.value))}
          className="w-20"
        >
          {PAGE_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </NativeSelect>
        <Button
          variant="outline"
          size="icon"
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft aria-hidden="true" />
        </Button>
        <span className="min-w-24 text-center text-muted-foreground">
          Page {formatNumber(page)} of {formatNumber(Math.max(totalPages, 1))}
        </span>
        <Button
          variant="outline"
          size="icon"
          onClick={() => onPage(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
        >
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
}
